import { useState } from "react";
import { ArrowRight, ArrowUpRight, ShieldCheck } from "lucide-react";
import Brand from "./BrandLogo";
import { brand } from "./brand-config";
import { Form, Field, Submit } from "./components";
import { enterDemo, identityFromSession, supabase } from "./data";
import type { Identity } from "./data";
import type { Role } from "./types";

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
      <section
        className="auth-story"
        aria-label="About Nexus Virtual Executives"
      >
        <a
          className="auth-brand"
          href={brand.instagram}
          target="_blank"
          rel="noreferrer"
          aria-label="Nexus Virtual Executives on Instagram"
        >
          <Brand />
        </a>
        <div className="auth-copy">
          <p className="auth-intro">Executive support, delivered.</p>
          <h1>
            Your business.
            <br />
            <span>Backed by Nexus.</span>
          </h1>
          <p className="auth-description">
            Request support, connect with your virtual executive, and keep every
            deliverable in view.
          </p>
          <ol className="auth-process" aria-label="How your workspace works">
            <li>
              <span>01</span>
              <div>
                <strong>Share the brief</strong>
                <p>Tell us what you need, your budget, and your deadline.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Work with your executive</strong>
                <p>Keep the conversation, files, and payments together.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Review the result</strong>
                <p>Approve the delivery and share your feedback.</p>
              </div>
            </li>
          </ol>
        </div>
        <footer className="auth-signature">
          <span>Supporting businesses since 2022</span>
          <a href={brand.instagram} target="_blank" rel="noreferrer">
            @nexusvirtualexecutives <ArrowUpRight size={13} />
          </a>
        </footer>
      </section>
      <section className="auth-form-side" aria-label="Workspace sign in">
        <div className="auth-topline">
          <span>Client & executive portal</span>
          <span className="prototype-label">Prototype 1</span>
        </div>
        <div className="auth-form">
          <h2>
            {signup
              ? "Create your client account"
              : supabase
                ? "Sign in to your workspace"
                : "Choose your workspace"}
          </h2>
          <p>
            {supabase
              ? "Manage your requests, conversations, and deliveries."
              : "Explore the client, virtual executive, or admin experience with a demo account."}
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
                  : "New to Nexus? Create a client account"}
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
                    title: "Executive workspace",
                    name: "Maya Bennett",
                    description: "Manage assignments and deliver work",
                    initials: "MB",
                  },
                  {
                    role: "admin",
                    title: "Admin workspace",
                    name: "Jordan Lee",
                    description: "Oversee people, payments, and output",
                    initials: "JL",
                  },
                ] as const
              ).map((p) => (
                <button
                  key={p.role}
                  className="demo-login"
                  onClick={() => onLogin(enterDemo(p.role as Role))}
                >
                  <span className="demo-person">{p.initials}</span>
                  <span>
                    <strong>{p.title}</strong>
                    <small>{p.description}</small>
                    <span className="demo-account-name">
                      Demo account · {p.name}
                    </span>
                  </span>
                  <ArrowRight size={18} />
                </button>
              ))}
            </div>
          )}
          <div className="auth-note">
            <ShieldCheck size={18} />
            <p>
              {supabase
                ? "Protected sign-in with Supabase Auth."
                : "Demo data stays in this browser. All payments are simulated; no real charges are made."}
            </p>
          </div>
        </div>
        <footer>
          <span>
            © {new Date().getFullYear()} {brand.name}
          </span>
          <a href={brand.instagram} target="_blank" rel="noreferrer">
            Meet Nexus <ArrowUpRight size={12} />
          </a>
        </footer>
      </section>
    </main>
  );
}
