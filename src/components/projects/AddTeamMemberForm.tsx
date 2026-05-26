"use client";

// src/components/projects/AddTeamMemberForm.tsx

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

// Role options that match the Prisma Role enum
const ROLE_OPTIONS = [
  { value: "CO_PI", label: "Co-PI" },
  { value: "JRF", label: "JRF (Junior Research Fellow)" },
] as const;

interface AddTeamMemberFormProps {
  projectId: string;
  /** Called after a member is successfully added so the parent can re-fetch */
  onSuccess: () => void;
}

interface FormState {
  email: string;
  role: string;
  stipend: string;
  joinDate: string;
}

const EMPTY_FORM: FormState = {
  email: "",
  role: "",
  stipend: "",
  joinDate: new Date().toISOString().split("T")[0], // today as YYYY-MM-DD
};

export default function AddTeamMemberForm({
  projectId,
  onSuccess,
}: AddTeamMemberFormProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<FormState>>({});

  function validate(): boolean {
    const next: Partial<FormState> = {};
    if (!form.email.trim()) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      next.email = "Enter a valid email address";
    if (!form.role) next.role = "Role is required";
    if (form.stipend && isNaN(Number(form.stipend)))
      next.stipend = "Stipend must be a number";
    if (form.stipend && Number(form.stipend) < 0)
      next.stipend = "Stipend cannot be negative";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setLoading(true);

    try {
      const res = await fetch("/api/personnel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          email: form.email.trim().toLowerCase(),
          role: form.role,
          stipend: form.stipend ? Number(form.stipend) : null,
          joinDate: form.joinDate || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Surface server-side errors (e.g. "User not found", "Already a member")
        toast.error(data.error ?? "Failed to add team member");
        return;
      }

      toast.success(`${data.user?.name ?? form.email} added to the project`);
      setForm(EMPTY_FORM);
      setErrors({});
      setOpen(false);
      onSuccess();
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setForm(EMPTY_FORM);
      setErrors({});
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2">
          <span aria-hidden="true">＋</span>
          Add team member
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add team member</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Email */}
          <div className="grid gap-1.5">
            <Label htmlFor="tm-email">
              User email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="tm-email"
              type="email"
              placeholder="researcher@institution.ac.in"
              value={form.email}
              onChange={(e) => {
                setForm((f) => ({ ...f, email: e.target.value }));
                setErrors((err) => ({ ...err, email: undefined }));
              }}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "tm-email-err" : undefined}
            />
            {errors.email && (
              <p id="tm-email-err" className="text-xs text-destructive">
                {errors.email}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              The user must already have a ResearchPilot account.
            </p>
          </div>

          {/* Role */}
          <div className="grid gap-1.5">
            <Label htmlFor="tm-role">
              Role <span className="text-destructive">*</span>
            </Label>
            <Select
              value={form.role}
              onValueChange={(val) => {
                setForm((f) => ({ ...f, role: val }));
                setErrors((err) => ({ ...err, role: undefined }));
              }}
            >
              <SelectTrigger id="tm-role" aria-invalid={!!errors.role}>
                <SelectValue placeholder="Select role…" />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.role && (
              <p className="text-xs text-destructive">{errors.role}</p>
            )}
          </div>

          {/* Stipend (optional) */}
          <div className="grid gap-1.5">
            <Label htmlFor="tm-stipend">Monthly stipend (₹) — optional</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm select-none">
                ₹
              </span>
              <Input
                id="tm-stipend"
                type="number"
                min={0}
                step={100}
                placeholder="31000"
                className="pl-7"
                value={form.stipend}
                onChange={(e) => {
                  setForm((f) => ({ ...f, stipend: e.target.value }));
                  setErrors((err) => ({ ...err, stipend: undefined }));
                }}
                aria-invalid={!!errors.stipend}
                aria-describedby={errors.stipend ? "tm-stipend-err" : undefined}
              />
            </div>
            {errors.stipend && (
              <p id="tm-stipend-err" className="text-xs text-destructive">
                {errors.stipend}
              </p>
            )}
          </div>

          {/* Join date (optional) */}
          <div className="grid gap-1.5">
            <Label htmlFor="tm-joindate">Join date — optional</Label>
            <Input
              id="tm-joindate"
              type="date"
              value={form.joinDate}
              onChange={(e) =>
                setForm((f) => ({ ...f, joinDate: e.target.value }))
              }
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="ghost" disabled={loading}>
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Adding…" : "Add member"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
