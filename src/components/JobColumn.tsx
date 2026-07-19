"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { JobSpec, UiPhase, VerticalConfig } from "@/lib/ui/types";
import { demoJobSpec, jobSpecFields, uiCopy } from "@/lib/ui/types";

type Props = {
  vertical: VerticalConfig;
  phase: UiPhase;
  jobSpec: JobSpec | null;
  onJobSpecChange: (spec: JobSpec) => void;
  onConfirm: () => void;
  voiceAgentId?: string | null;
  busy?: boolean;
};

export function JobColumn({
  vertical,
  phase,
  jobSpec,
  onJobSpecChange,
  onConfirm,
  voiceAgentId,
  busy,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
  const [intakeId, setIntakeId] = useState<string | null>(null);
  const locked = phase !== "draft";
  const copy = uiCopy(vertical);
  const fields = jobSpecFields(vertical);

  const stopVoicePoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopVoicePoll(), [stopVoicePoll]);

  const useDemo = useCallback(() => {
    onJobSpecChange(demoJobSpec(vertical));
    setUploadMsg(null);
    setVoiceStatus(null);
    stopVoicePoll();
  }, [onJobSpecChange, vertical, stopVoicePoll]);

  const startVoiceIntake = useCallback(async () => {
    if (locked) return;
    setVoiceStatus("Starting intake session…");
    stopVoicePoll();
    try {
      const res = await fetch("/api/intake/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vertical: vertical.id }),
      });
      if (!res.ok) throw new Error("intake start failed");
      const data = (await res.json()) as {
        intake_id: string;
        talk_url?: string | null;
        agent_id?: string | null;
      };
      setIntakeId(data.intake_id);

      const talk =
        data.talk_url ||
        (data.agent_id
          ? `https://elevenlabs.io/app/talk-to?agent_id=${encodeURIComponent(data.agent_id)}`
          : voiceAgentId
            ? `https://elevenlabs.io/app/talk-to?agent_id=${encodeURIComponent(voiceAgentId)}`
            : null);

      if (talk) {
        window.open(talk, "_blank", "noopener,noreferrer");
        setVoiceStatus(
          "Voice tab opened. Tell the agent your AC details, then ask it to submit the job. Form fills automatically…"
        );
      } else {
        setVoiceStatus(
          "No intake agent id — use demo job, or set NEXT_PUBLIC_ELEVENLABS_INTAKE_AGENT_ID"
        );
      }

      // Poll for submit_spec webhook result
      let ticks = 0;
      pollRef.current = setInterval(async () => {
        ticks += 1;
        if (ticks > 120) {
          stopVoicePoll();
          setVoiceStatus(
            "Timed out waiting for agent. Use demo job, or ensure submit_spec webhook hits this app."
          );
          return;
        }
        try {
          const s = await fetch(
            `/api/intake/status?intake_id=${encodeURIComponent(data.intake_id)}&vertical=${encodeURIComponent(vertical.id)}`,
            { cache: "no-store" }
          );
          if (!s.ok) return;
          const body = (await s.json()) as {
            draft?: { status?: string; job_spec?: JobSpec };
          };
          if (body.draft?.status === "filled" && body.draft.job_spec) {
            onJobSpecChange(body.draft.job_spec);
            setVoiceStatus("Job filled from voice intake ✓");
            stopVoicePoll();
          }
        } catch {
          /* keep polling */
        }
      }, 2000);
    } catch (e) {
      setVoiceStatus(
        e instanceof Error ? e.message : "Could not start voice intake"
      );
    }
  }, [
    locked,
    vertical.id,
    voiceAgentId,
    onJobSpecChange,
    stopVoicePoll,
  ]);

  const handlePdf = useCallback(
    async (file: File) => {
      setUploadMsg("Reading PDF…");
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("vertical", vertical.id);

        // Create a draft job then extract if needed
        const createRes = await fetch("/api/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vertical: vertical.id, job_spec: {} }),
        });
        if (createRes.ok) {
          const created = (await createRes.json()) as {
            job?: { id: string };
          };
          const jobId = created.job?.id;
          if (jobId) {
            const res = await fetch(`/api/jobs/${jobId}/extract-pdf`, {
              method: "POST",
              body: fd,
            });
            if (res.ok) {
              const data = (await res.json()) as {
                job?: { job_spec?: JobSpec };
              };
              if (data.job?.job_spec) {
                onJobSpecChange(data.job.job_spec as JobSpec);
                setUploadMsg("Job filled from PDF");
                return;
              }
            }
          }
        }

        onJobSpecChange(demoJobSpec(vertical));
        setUploadMsg("Extract offline — loaded demo job (edit as needed)");
      } catch {
        onJobSpecChange(demoJobSpec(vertical));
        setUploadMsg("Extract offline — loaded demo job (edit as needed)");
      }
    },
    [onJobSpecChange, vertical],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (locked) return;
      const f = e.dataTransfer.files?.[0];
      if (f && (f.type === "application/pdf" || f.name.endsWith(".pdf"))) {
        void handlePdf(f);
      } else {
        setUploadMsg("Please drop a PDF file");
      }
    },
    [handlePdf, locked],
  );

  const hasSpec = jobSpec && Object.keys(jobSpec).length > 0;

  return (
    <section className="flex h-full min-h-0 flex-col gap-3.5">
      <header>
        <p className="label-section">Job</p>
        <h2 className="mt-0.5 text-[17px] font-medium tracking-tight text-[var(--color-ink)]">
          {copy.job_column_title}
        </h2>
        <p className="text-[13px] text-[var(--color-smoke)]">
          {vertical.displayName || vertical.label || vertical.name}
        </p>
      </header>

      <div className="glass-inner p-3.5">
        <div className="space-y-2">
          <p className="text-sm font-medium text-[var(--color-graphite)]">
            {copy.voice_intake_label}
          </p>
          <button
            type="button"
            disabled={locked}
            onClick={() => void startVoiceIntake()}
            className="btn-pill btn-pill-primary disabled:opacity-40"
          >
            <MicIcon />
            Start voice intake
          </button>
          {voiceStatus && (
            <p className="rounded-lg bg-white/50 px-2.5 py-1.5 text-xs text-[var(--color-graphite)]">
              {voiceStatus}
              {intakeId ? (
                <span className="mt-0.5 block text-[10px] text-[var(--color-ash)]">
                  intake_id: {intakeId.slice(0, 8)}…
                </span>
              ) : null}
            </p>
          )}
          <p className="text-xs leading-relaxed text-[var(--color-smoke)]">
            Speak your job, then say <strong>“submit the job”</strong>. The
            form fills automatically.
          </p>
        </div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!locked) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`rounded-2xl border border-dashed p-3.5 text-center transition-colors ${
          dragOver
            ? "border-[var(--color-ink)]/30 bg-white/50"
            : "border-white/50 bg-white/20"
        }`}
      >
        <p className="text-sm text-[var(--color-smoke)]">
          {copy.pdf_upload_label}
        </p>
        <button
          type="button"
          disabled={locked}
          onClick={() => fileRef.current?.click()}
          className="mt-1.5 text-sm font-medium text-[var(--color-ink)] underline-offset-2 hover:underline disabled:opacity-40"
        >
          Choose PDF
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handlePdf(f);
          }}
        />
        {uploadMsg && (
          <p className="mt-2 text-xs text-[var(--color-smoke)]">{uploadMsg}</p>
        )}
      </div>

      <button
        type="button"
        disabled={locked}
        onClick={useDemo}
        className="btn-pill btn-pill-outline w-full disabled:opacity-40"
      >
        {copy.demo_job_button}
      </button>

      <div className="glass-inner min-h-0 flex-1 overflow-auto p-3.5">
        {!hasSpec ? (
          <p className="text-sm text-[var(--color-ash)]">
            Job details appear after voice, PDF, or demo job.
          </p>
        ) : (
          <dl className="space-y-2 text-sm">
            {fields.map((f) => {
              const val = jobSpec?.[f.key];
              if (val === undefined || val === null || val === "") return null;
              return (
                <div
                  key={f.key}
                  className="flex justify-between gap-3 border-b border-white/30 pb-1.5"
                >
                  <dt className="text-[var(--color-smoke)]">{f.label}</dt>
                  <dd className="text-right font-medium text-[var(--color-ink)]">
                    {String(val)}
                  </dd>
                </div>
              );
            })}
          </dl>
        )}
      </div>

      <button
        type="button"
        disabled={!hasSpec || locked || busy}
        onClick={onConfirm}
        className="btn-pill btn-pill-primary w-full py-3 text-sm disabled:cursor-not-allowed disabled:opacity-40"
      >
        {locked
          ? phase === "calling"
            ? "Agents calling…"
            : "Confirmed"
          : copy.confirm_button}
      </button>
    </section>
  );
}

function MicIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}
