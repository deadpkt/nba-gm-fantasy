import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import { getInternalReturnPath } from "../lib/routeAccess";
import { getUserFriendlyError } from "../lib/clientErrors";

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
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user && !loading)
      navigate(getInternalReturnPath(location.state?.from), { replace: true });
  }, [user, loading, location.state, navigate]);

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
      if (isSignUp) await signUp(form);
      else await login(form);
    } catch (authError) {
      setError(getUserFriendlyError(authError, "Could not sign in. Check your details and try again."));
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
      setError(getUserFriendlyError(authError, "Could not sign in. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  if (!firebaseEnabled)
    return (
      <section className="auth-card setup-card">
        <p className="section-label">SERVICE UNAVAILABLE</p>
        <h1>Sign-in is temporarily unavailable.</h1>
        <p>
          Please try again later.
        </p>
      </section>
    );

  const message = error || (authError ? getUserFriendlyError(authError, "Could not sign in. Please try again.") : "");
  return (
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
          <label>
            Display name
            <input
              name="displayName"
              value={form.displayName}
              onChange={updateField}
              minLength="2"
              required
              autoComplete="name"
            />
          </label>
        )}
        <label>
          Email
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={updateField}
            required
            autoComplete="email"
          />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={updateField}
            minLength="6"
            required
            autoComplete={isSignUp ? "new-password" : "current-password"}
          />
        </label>
        {message && (
          <p className="form-error" role="alert">
            {message}
          </p>
        )}
        <button disabled={submitting}>
          {submitting
            ? "Please wait..."
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
        {isSignUp ? "Already have an account?" : "New to Full Court?"}{" "}
        <Link to={isSignUp ? "/login" : "/signup"} state={location.state}>
          {isSignUp ? "Login" : "Create one"}
        </Link>
      </p>
    </section>
  );
}

export default AuthForm;
