"use client";

import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/i18n/id";
import { login, type LoginState } from "@/server/auth-actions";

export function LoginForm() {
  const next = useSearchParams().get("next") ?? "";
  const [state, action, pending] = useActionState<LoginState, FormData>(login, { error: null, email: "" });
  const [showPassword, setShowPassword] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  // §3.1 error state: clear and focus the password field.
  useEffect(() => {
    if (state.error && passwordRef.current) {
      passwordRef.current.value = "";
      passwordRef.current.focus();
    }
  }, [state]);

  return (
    <form action={action} className="mt-6 space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      {state.error && (
        <Alert variant="destructive" aria-live="polite">
          <AlertCircle />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">{t.auth.email}</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required defaultValue={state.email} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{t.auth.password}</Label>
        <div className="relative">
          <Input
            ref={passwordRef}
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            className="pr-12"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute top-1/2 right-1 -translate-y-1/2"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? t.auth.hidePassword : t.auth.showPassword}
          >
            {showPassword ? <EyeOff /> : <Eye />}
          </Button>
        </div>
      </div>
      <Button type="submit" className="w-full" pending={pending}>
        {t.auth.submit}
      </Button>
    </form>
  );
}
