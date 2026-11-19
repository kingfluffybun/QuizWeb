"use server";

import {
  reqPassResetImpl,
  resetPassImpl,
  verifyOTPImpl,
} from "@/lib/server/auth/password-reset";
import {
  signUpImpl,
  verifyEmailImpl,
} from "@/lib/server/auth/registration";
import {
  checkLoginRateLimitImpl,
  signOutActionImpl,
} from "@/lib/server/auth/session-actions";

export async function signUp(formData: FormData) {
  return signUpImpl(formData);
}

export async function verifyEmail(token: string) {
  return verifyEmailImpl(token);
}

export async function reqPassReset(emailInput: string | FormData) {
  return reqPassResetImpl(emailInput);
}

export async function verifyOTP(email: string, otpCode: string) {
  return verifyOTPImpl(email, otpCode);
}

export async function resetPass(
  email: string,
  otpCode: string,
  newPassword: string,
) {
  return resetPassImpl(email, otpCode, newPassword);
}

export async function checkLoginRateLimit(email: string) {
  return checkLoginRateLimitImpl(email);
}

export async function signOutAction() {
  return signOutActionImpl();
}
