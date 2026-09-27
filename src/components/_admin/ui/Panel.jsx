'use client';

/**
 * A titled surface. Title and description on the left, an optional action on
 * the right, content underneath. Use one per distinct piece of information —
 * not as decoration around everything.
 */
export default function Panel({ title, description, action, children, className = '', bodyClassName = '', id }) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section className={`card-ui ${className}`} aria-labelledby={headingId}>
      {(title || action) && (
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pt-5">
          <div className="min-w-0">
            {title && (
              <h2 id={headingId} className="text-[15px] font-semibold text-slate-900">
                {title}
              </h2>
            )}
            {description && <p className="mt-0.5 text-[13px] leading-relaxed text-slate-500">{description}</p>}
          </div>
          {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
        </div>
      )}
      <div className={`p-5 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/** A heading that introduces a group of panels. */
export function SectionHeading({ title, description, action }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}
