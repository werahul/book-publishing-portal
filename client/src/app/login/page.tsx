import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · BookLeaf Support" };

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 space-y-1">
          <h1 className="text-xl font-semibold text-slate-900">
            <span className="text-emerald-700">BookLeaf</span> Support
          </h1>
          <p className="text-sm text-slate-500">Sign in to track your books, royalties and support requests.</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
