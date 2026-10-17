"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";
import { Button, Card, Input, Select } from "@/app/ui";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";

export default function RegisterForm() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [createdEmail, setCreatedEmail] = useState<string | null>(null);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">(
    "idle"
  );

  async function resend() {
    if (!createdEmail) return;
    setResendState("sending");
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: createdEmail }),
      });
      setResendState(res.ok ? "sent" : "idle");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not resend. Try again.");
      }
    } catch {
      setResendState("idle");
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          middleName: middleName.trim(),
          lastName: lastName.trim(),
          email,
          gender,
          password,
          instructorCode: studentCode,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Registration failed. Please try again.");
        submitting.current = false;
        setBusy(false);
        return;
      }
      if (data.needVerification) {
        setCreatedEmail(email);
        submitting.current = false;
        setBusy(false);
        return;
      }
      // Push straight to the student landing page (no router.refresh(): see
      // LoginForm for why refreshing here can drop the navigation), and stay
      // busy through the navigation so a slow render can't take a second submit
      // that rotates the freshly-issued session.
      router.push("/subjects");
    } catch {
      setError(
        "Could not reach the server. Check your connection, wait a moment, then try again."
      );
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-2">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white">
            V
          </span>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Create your account
          </h1>
          <p className="text-sm text-slate-500">
            Your instructor&apos;s code links your account to them
          </p>
        </div>
        {createdEmail ? (
          <Card className="space-y-4 p-6">
            <h2 className="text-base font-semibold text-slate-900">
              Check your inbox
            </h2>
            <p className="text-sm text-slate-600">
              We sent a verification link to{" "}
              <span className="font-medium text-slate-900">
                {createdEmail}
              </span>
              . Click it to activate your account, then sign in.
            </p>
            <div className="flex items-center justify-between gap-3 pt-1">
              <Button
                variant="secondary"
                disabled={resendState === "sending"}
                onClick={() => void resend()}
              >
                {resendState === "sending"
                  ? "Sending…"
                  : resendState === "sent"
                    ? "Email sent"
                    : "Resend email"}
              </Button>
              <Link
                href="/login"
                className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
              >
                Go to sign in
              </Link>
            </div>
          </Card>
        ) : (
          <Card as="form" onSubmit={onSubmit} className="space-y-4 p-6">
          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <Input
              id="first-name"
              label="First name"
              type="text"
              required
              autoComplete="given-name"
              placeholder="Jane"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <Input
              id="last-name"
              label="Last name"
              type="text"
              required
              autoComplete="family-name"
              placeholder="Doe"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
          <Input
            id="middle-name"
            label="Middle name (optional)"
            type="text"
            autoComplete="additional-name"
            placeholder="e.g. Marie"
            value={middleName}
            onChange={(e) => setMiddleName(e.target.value)}
          />
          <Input
            id="email"
            label="Email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@school.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Select
            id="gender"
            label="Gender"
            required
            value={gender}
            onChange={(e) => setGender(e.target.value)}
          >
            <option value="" disabled>
              Select gender
            </option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
          </Select>
          <Input
            id="instructor-code"
            label="Instructor code"
            type="text"
            required
            autoComplete="off"
            placeholder="e.g. ABC234"
            value={studentCode}
            onChange={(e) => setStudentCode(e.target.value.toUpperCase())}
          />
          <Input
            id="password"
            label="Password"
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Input
            id="confirm-password"
            label="Retype password"
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            placeholder="Re-enter your password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Creating account…" : "Create account"}
          </Button>
          <p className="text-center text-sm text-slate-500">
            Already registered?{" "}
            <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
              Sign in
            </Link>
          </p>
        </Card>
        )}
      </div>
    </main>
  );
}