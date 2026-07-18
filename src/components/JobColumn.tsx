"use client";

import { useCallback, useRef, useState } from "react";
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
  const [dragOver, setDragOver] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const locked = phase !== "draft";
  const copy = uiCopy(vertical);
  const fields = jobSpecFields(vertical);

  const useDemo = useCallback(() => {
    onJobSpecChange(demoJobSpec(vertical));
    setUploadMsg(null);
  }, [onJobSpecChange, vertical]);

  const handlePdf = useCallback(
    async (file: File) => {
      setUploadMsg("Reading PDF…");
      try {
        // Prefer job-scoped extract if a draft job already exists; else intake
        const fd = new FormData();
        fd.append("file", file);
        fd.append("vertical", vertical.id);

        let res = await fetch("/api/intake/pdf", { method: "POST", body: fd });
        if (!res.ok) {
          // try alternate path used by backend agents
          res = await fetch("/api/jobs/extract-pdf", {
            method: "POST",
            body: fd,
          });
        }
        if (res.ok) {
          const data = (await res.json()) as { job_spec?: JobSpec };
          if (data.job_spec) {
            onJobSpecChange(data.job_spec);
            setUploadMsg("Job filled from PDF");
            return;
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
    <section className="flex h-full min-h-0 flex-col gap-4">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
          Job
        </p>
        <h2 className="text-lg font-semibold text-slate-900">
          {copy.job_column_title}
        </h2>
        <p className="text-sm text-slate-500">
          {vertical.displayName || vertical.label || vertical.name}
        </p>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {voiceAgentId ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-800">
              {copy.voice_intake_label}
            </p>
            <a
              href={`https://elevenlabs.io/app/talk-to?agent_id=${encodeURIComponent(voiceAgentId)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              <MicIcon />
              Start voice intake
            </a>
            <p className="text-xs text-slate-500">
              Or use the demo job below if the agent is still connecting.
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <MicIcon />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">
                Voice intake (connect agent)
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Set{" "}
                <code className="rounded bg-slate-100 px-1">
                  NEXT_PUBLIC_ELEVENLABS_INTAKE_AGENT_ID
                </code>{" "}
                or use a demo job.
              </p>
            </div>
          </div>
        )}
        {!locked && (
          <button
            type="button"
            onClick={useDemo}
            className="mt-3 w-full rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
          >
            {copy.demo_job_button}
          </button>
        )}
      </div>

      {!locked && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-4 text-center transition-colors ${
            dragOver
              ? "border-emerald-400 bg-emerald-50"
              : "border-slate-200 bg-white hover:border-slate-300"
          }`}
        >
          <p className="text-sm font-medium text-slate-700">
            {copy.pdf_upload_label}
          </p>
          <p className="mt-1 text-xs text-slate-400">PDF only · click or drag</p>
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
            <p className="mt-2 text-xs text-emerald-700">{uploadMsg}</p>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {!hasSpec ? (
          <p className="text-sm text-slate-400">
            Job details appear here after voice intake, PDF, or demo job.
          </p>
        ) : (
          <dl className="space-y-2.5">
            {fields.map((f) => {
              const raw = jobSpec?.[f.key];
              const val =
                raw === null || raw === undefined ? "" : String(raw);
              return (
                <div key={f.key} className="grid grid-cols-[7rem_1fr] gap-2">
                  <dt className="pt-0.5 text-xs font-medium text-slate-500">
                    {f.label}
                  </dt>
                  <dd>
                    {locked ? (
                      <span className="text-sm text-slate-900">
                        {val || "—"}
                      </span>
                    ) : (
                      <input
                        className="w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                        value={val}
                        onChange={(e) => {
                          const next = e.target.value;
                          const asNum =
                            f.type === "number" && next !== ""
                              ? Number(next)
                              : next;
                          onJobSpecChange({
                            ...jobSpec!,
                            [f.key]:
                              f.type === "number" && next !== "" && !Number.isNaN(asNum as number)
                                ? (asNum as number)
                                : next,
                          });
                        }}
                      />
                    )}
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
        className="w-full rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
      >
        {locked
          ? phase === "complete"
            ? "Quotes complete"
            : "Calling vendors…"
          : copy.confirm_button}
      </button>
    </section>
  );
}

function MicIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}
