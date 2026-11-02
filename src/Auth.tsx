import { useState } from "react";
import { ArrowRight, ArrowUpRight, ShieldCheck } from "lucide-react";
import { Form, Field, Submit } from "./components";
import { enterDemo, identityFromSession, supabase } from "./data";
import type { Identity } from "./data";
import type { Role } from "./types";
import { buildLabel, environmentLabel, versionLabel } from "./app-config";

export default function Auth({
  onLogin,
}: {
  onLogin: (identity: Identity) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [signup, setSignup] = useState(false);
  const [notice, setNotice] = useState("");
  const login = async (form: FormData) => {
    if (!supabase) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const email = String(form.get("email"));
      const password = String(form.get("password"));
      if (signup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name: String(form.get("name")) } },
        });
        if (error) throw error;
        if (data.session) {
          const id = await identityFromSession(data.session);
          if (id) onLogin(id);
        } else
          setNotice("Check your email to confirm your account, then sign in.");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        const id = await identityFromSession(data.session);
        if (id) onLogin(id);
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Sign in failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="auth">
      <div className="auth-story">
        <a className="brand" href="#">
          <span className="brand-icon">
            <span aria-hidden="true">N</span>
          </span>
          Nexus VA
        </a>
        <div className="auth-copy">
          <h1>
            Your projects.
            <br />
            Your people.
            <br />
            <em>One workspace.</em>
          </h1>
          <p>
            Request support, work with your assistant, and review every delivery
            in one place.
          </p>
          <div className="auth-workflow" aria-label="Your service workflow">
            <span>Request</span>
            <ArrowRight size={14} />
            <span>Collaborate</span>
            <ArrowRight size={14} />
            <span>Review</span>
          </div>
        </div>
        <footer>
          <span>Client · Assistant · Admin</span>
          <span title={buildLabel}>Prototype 1 · {versionLabel}</span>
        </footer>
      </div>
      <div className="auth-form-side">
        <span className="prototype-label" title={buildLabel}>
          <span /> {environmentLabel} · {versionLabel}
        </span>
        <div className="auth-form">
          <h2>{signup ? "Create your client account" : "Welcome to Nexus."}</h2>
          <p>
            {supabase
              ? "Sign in to pick up where you left off."
              : "Choose a demo account to explore service requests, conversations, and deliveries."}
          </p>
          {supabase ? (
            <Form onSubmit={login}>
              {signup && (
                <Field label="Full name">
                  <input
                    name="name"
                    autoComplete="name"
                    required
                    minLength={2}
                    placeholder="Your full name"
                  />
                </Field>
              )}
              <Field label="Email address">
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  placeholder="you@company.com"
                />
              </Field>
              <Field label="Password">
                <input
                  type="password"
                  name="password"
                  autoComplete={signup ? "new-password" : "current-password"}
                  minLength={8}
                  required
                  placeholder="Enter your password"
                />
              </Field>
              {error && (
                <p className="inline-error" role="alert">
                  {error}
                </p>
              )}
              {notice && <p className="inline-success">{notice}</p>}
              <Submit busy={busy}>
                {signup ? "Create client account" : "Sign in"}
                <ArrowRight size={17} />
              </Submit>
              <button
                type="button"
                className="text-button"
                onClick={() => setSignup(!signup)}
              >
                {signup
                  ? "Already have an account? Sign in"
                  : "New here? Create a client account"}
              </button>
            </Form>
          ) : (
            <div className="demo-logins">
              {(
                [
                  {
                    role: "client",
                    title: "Client workspace",
                    name: "Alex Morgan",
                    description: "Request services and review deliveries",
                    initials: "AM",
                  },
                  {
                    role: "staff",
                    title: "Virtual assistant workspace",
                    name: "Maya Bennett",
                    description: "Manage assignments and deliver output",
                    initials: "MB",
                  },
                  {
                    role: "admin",
                    title: "Admin workspace",
                    name: "Jordan Lee",
                    description: "Review assignments, payments, and delivery",
                    initials: "JL",
                  },
                ] as const
              ).map((p, i) => (
                <button
                  key={p.role}
                  className="demo-login"
                  onClick={() => onLogin(enterDemo(p.role as Role))}
                >
                  <span className={`avatar avatar-${i}`}>{p.initials}</span>
                  <span>
                    <strong>{p.title}</strong>
                    <small>
                      Demo: {p.name} · {p.description}
                    </small>
                  </span>
                  <ArrowUpRight size={19} />
                </button>
              ))}
            </div>
          )}
          <div className="auth-note">
            <ShieldCheck size={17} />
            <span>
              {supabase
                ? "Your account is protected with Supabase Auth."
                : "Demo data stays in this browser. Payments are simulated; no real charges are made."}
            </span>
          </div>
        </div>
        <footer>
          <span>© {new Date().getFullYear()} Nexus VA</span>
          <span>Client & staff portal</span>
        </footer>
      </div>
    </main>
  );
}
