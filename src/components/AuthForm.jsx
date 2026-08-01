import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import { getInternalReturnPath } from "../lib/routeAccess";
import { getUserFriendlyError, reportClientError } from "../lib/clientErrors";
import "../auth.css";

function AuthForm({ mode }) {
  const isSignUp = mode === "signup";
  const {
    user,
    loading,
    authError,
    signUp,
    login,
    signInWithGoogle,
    firebaseEnabled,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user && !loading && !submitting)
      navigate(getInternalReturnPath(location.state?.from), { replace: true });
  }, [user, loading, submitting, location.state, navigate]);

  function updateField(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (isSignUp && form.password !== form.confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      if (isSignUp) await signUp(form);
      else await login(form);
    } catch (authError) {
      reportClientError(isSignUp ? "Email/password registration" : "Email/password login", authError);
      setError(
        getUserFriendlyError(
          authError,
          "Could not sign in. Check your details and try again.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function submitGoogle() {
    setError("");
    setSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (authError) {
      reportClientError("Google sign-in", authError);
      setError(
        getUserFriendlyError(authError, "Could not sign in. Please try again."),
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!firebaseEnabled)
    return (
      <section className="auth-card setup-card">
        <p className="section-label">SERVICE UNAVAILABLE</p>
        <h1>Sign-in is temporarily unavailable.</h1>
        <p>Please try again later.</p>
      </section>
    );

  const message =
    error ||
    (authError
      ? getUserFriendlyError(authError, "Could not sign in. Please try again.")
      : "");
  return (
    <div className="auth-shell">
      <section className="auth-brand" aria-label="FULL COURT">
        <div className="auth-brand__mark" aria-hidden="true"><i /><i /><i /></div>
        <div><p>FULL COURT</p><h2>Build the team.<br /><span>Own the era.</span></h2><small>Draft together. Compete live. Build a dynasty that lasts.</small></div>
        <svg viewBox="0 0 460 300" aria-hidden="true"><path d="M20 20h420v260H20zM20 78h92v144H20M112 78v144M112 100a72 72 0 0 1 0 100M46 124v52M64 150h-18" /><circle cx="112" cy="150" r="50" /><path d="M20 48h28a155 155 0 0 1 0 204H20" /></svg>
      </section>
      <section className="auth-card">
      <p className="section-label">
        {isSignUp ? "JOIN THE LEAGUE" : "WELCOME BACK"}
      </p>
      <h1>
        {isSignUp ? "Create your franchise." : "Sign in to your franchise."}
      </h1>
      <p>
        {isSignUp
          ? "Your roster and results will be saved to your account."
          : "Continue building your championship roster."}
      </p>
      <form onSubmit={submit}>
        {isSignUp && (
          <label className="auth-field">
            <input
              name="displayName"
              placeholder=" "
              value={form.displayName}
              onChange={updateField}
              minLength="2"
              required
              autoComplete="name"
            />
            <span>Display name</span>
          </label>
        )}
        <label className="auth-field">
          <input
            name="email"
            type="email"
            placeholder=" "
            value={form.email}
            onChange={updateField}
            required
            autoComplete="email"
          />
          <span>Email</span>
        </label>
        <label className="auth-field">
          <input
            name="password"
            type="password"
            placeholder=" "
            value={form.password}
            onChange={updateField}
            minLength="6"
            required
            autoComplete={isSignUp ? "new-password" : "current-password"}
          />
          <span>Password</span>
        </label>
        {isSignUp && <label className="auth-field"><input name="confirmPassword" type="password" placeholder=" " value={form.confirmPassword} onChange={updateField} minLength="6" required autoComplete="new-password" /><span>Confirm password</span></label>}
        {message && (
          <p className="form-error" role="alert">
            {message}
          </p>
        )}
        <button disabled={submitting}>
          {submitting
            ? isSignUp ? "Creating account..." : "Signing in..."
            : isSignUp
              ? "Create account"
              : "Login"}
        </button>
      </form>
      <div className="auth-divider">
        <span>OR</span>
      </div>
      <button
        className="google-button"
        type="button"
        disabled={submitting}
        onClick={submitGoogle}
      >
        <span aria-hidden="true">G</span> Continue with Google
      </button>
      <p className="auth-switch">
        <span>{isSignUp ? "Already a GM?" : "New to FULL COURT?"}</span>
        <Link to={isSignUp ? "/login" : "/signup"} state={location.state}>
          {isSignUp ? "Sign in" : "Create an account"}
        </Link>
      </p>
      </section>
    </div>
  );
}

export default AuthForm;
