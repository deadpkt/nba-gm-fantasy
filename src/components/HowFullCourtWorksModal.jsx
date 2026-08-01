import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";

const STEPS = [
  {
    number: "01",
    title: "Draft",
    detail: "Build your roster from real NBA players.",
  },
  {
    number: "02",
    title: "Compete",
    detail: "Play synchronized league games with friends.",
  },
  {
    number: "03",
    title: "Dynasty",
    detail: "Win seasons, manage your franchise, and build history.",
  },
];

function HowFullCourtWorksModal({ onClose }) {
  const closeRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;

      const focusable = dialogRef.current?.querySelectorAll("button, a[href]");
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="how-full-court-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="how-full-court-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="how-full-court-title"
      >
        <button
          className="how-full-court-modal__close"
          ref={closeRef}
          type="button"
          aria-label="Close How FULL COURT Works"
          onClick={onClose}
        >
          &times;
        </button>
        <p className="how-full-court-modal__eyebrow">FULL COURT</p>
        <h2 id="how-full-court-title">How FULL COURT Works</h2>
        <p className="how-full-court-modal__intro">
          Build a franchise with friends, compete through complete seasons, and
          turn every title into part of your dynasty.
        </p>
        <div className="how-full-court-modal__steps">
          {STEPS.map((step) => (
            <article className="how-full-court-modal__step" key={step.number}>
              <span>{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.detail}</p>
            </article>
          ))}
        </div>
        <Link
          className="button-primary how-full-court-modal__cta"
          to="/league"
          onClick={onClose}
        >
          Start Your League <span aria-hidden="true">&rarr;</span>
        </Link>
      </section>
    </div>
  );
}

export default HowFullCourtWorksModal;
