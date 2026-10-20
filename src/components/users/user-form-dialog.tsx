"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { useSessionUser } from "@/components/shell/session-context";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { STAFF_ROLES } from "@/data/permissions";
import type { User, UserRole } from "@/data/types";
import { api } from "@/lib/api";
import { useCreateUser, useUpdateUser } from "@/lib/api/queries";
import { isValidRuc } from "@/lib/format";
import { useT } from "@/lib/prefs";

const PHONE = /^\+?51\s?9\d{2}\s?\d{3}\s?\d{3}$/;

/** Alta de cliente o invitación de personal, y edición de una cuenta existente. */
export function UserFormDialog({ open, onClose, user }: { open: boolean; onClose: () => void; user?: User | null }) {
  const t = useT();
  const f = t.form;
  const me = useSessionUser();
  const toast = useToast();
  const create = useCreateUser();
  const update = useUpdateUser();
  const editing = Boolean(user);

  const schema = useMemo(
    () =>
      z
        .object({
          name: z.string().trim().min(1, f.required).refine((v) => v.split(/\s+/).length >= 2, f.nameShort),
          email: z.string().trim().min(1, f.required).email(f.invalidEmail),
          company: z.string().trim(),
          ruc: z.string().trim().refine((v) => !v || isValidRuc(v), f.invalidRuc),
          phone: z.string().trim().refine((v) => !v || PHONE.test(v), f.invalidPhone),
          kind: z.enum(["customer", "staff"]),
          roles: z.array(z.string()),
          status: z.enum(["active", "pending", "disabled"]),
          notes: z.string(),
        })
        .refine((v) => v.kind === "customer" || v.roles.length > 0, { message: f.needRole, path: ["roles"] }),
    [f],
  );
  type Values = z.infer<typeof schema>;

  const caps = api.capabilities;
  const empty: Values = { name: "", email: "", company: "", ruc: "", phone: "", kind: caps.createCustomers ? "customer" : "staff", roles: [], status: "pending", notes: "" };
  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: empty });

  useEffect(() => {
    if (!open) return;
    reset(
      user
        ? {
            name: user.name,
            email: user.email,
            company: user.company ?? "",
            ruc: user.ruc ?? "",
            phone: user.phone ?? "",
            kind: user.kind,
            roles: user.kind === "staff" ? user.roles : [],
            status: user.status,
            notes: user.notes,
          }
        : empty,
    );
    // "empty" es constante en la práctica; solo importa al abrir o cambiar de usuario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user, reset]);

  const kind = useWatch({ control, name: "kind" });
  const busy = create.isPending || update.isPending;

  const onSubmit = handleSubmit((v) => {
    const draft = {
      name: v.name,
      email: v.email,
      company: v.company || null,
      ruc: v.ruc || null,
      phone: v.phone || null,
      kind: v.kind,
      roles: (v.kind === "customer" ? ["customer"] : v.roles) as UserRole[],
      status: v.status,
      notes: v.notes,
    };
    const fail = (e: Error) => (e.message === "email_taken" ? setError("email", { message: f.emailTaken }) : toast.error(t.common.error));
    if (user) {
      update.mutate(
        { id: user.id, patch: draft, actor: me.name },
        {
          onSuccess: () => {
            toast.success(t.toast.updated);
            onClose();
          },
          onError: fail,
        },
      );
    } else {
      create.mutate(
        { draft, actor: me.name },
        {
          onSuccess: (u) => {
            toast.success(u.kind === "staff" ? t.toast.invited(u.email) : t.toast.created(u.name));
            onClose();
          },
          onError: fail,
        },
      );
    }
  });

  const err = (name: keyof Values) =>
    errors[name] ? (
      <p className="field__error" id={`uf-${name}-error`}>
        {errors[name]?.message as string}
      </p>
    ) : null;
  const aria = (name: keyof Values) => ({ "aria-invalid": errors[name] ? true : undefined, "aria-describedby": errors[name] ? `uf-${name}-error` : undefined });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? f.editTitle : f.newTitle}
      description={editing ? f.editSub : f.newSub}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            {t.common.cancel}
          </button>
          <button type="submit" form="user-form" className="btn btn--primary" disabled={busy}>
            {busy && <span className="spinner" aria-hidden="true" />}
            {busy ? (editing ? t.common.saving : f.creating) : editing ? t.common.save : f.create}
          </button>
        </>
      }
    >
      <form id="user-form" className="user-form" onSubmit={onSubmit} noValidate>
        {/* Con Backend solo se invita personal: los clientes se registran en el sitio y aceptan allí el aviso de privacidad. */}
        {!editing && caps.createCustomers && (
          <fieldset className="user-form__kind">
            <legend className="field__label">{f.kind}</legend>
            <div className="segmented">
              {(["customer", "staff"] as const).map((k) => (
                <label key={k} className="segmented__option">
                  <input type="radio" value={k} {...register("kind")} />
                  <span>{t.kind[k]}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div className="user-form__grid">
          <div className="field user-form__wide">
            <label className="field__label" htmlFor="uf-name">
              {f.name}
            </label>
            <input id="uf-name" className="input" autoComplete="off" placeholder={f.namePh} {...register("name")} {...aria("name")} />
            {err("name")}
          </div>
          <div className="field user-form__wide">
            <label className="field__label" htmlFor="uf-email">
              {f.email}
            </label>
            <input id="uf-email" className="input" type="email" autoComplete="off" placeholder={f.emailPh} readOnly={editing && !caps.editEmail} {...register("email")} {...aria("email")} />
            {err("email")}
          </div>
          <div className="field">
            <label className="field__label" htmlFor="uf-company">
              {f.company} <span className="field__optional">{f.optional}</span>
            </label>
            <input id="uf-company" className="input" placeholder={f.companyPh} {...register("company")} />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="uf-ruc">
              {f.ruc} <span className="field__optional">{f.optional}</span>
            </label>
            <input id="uf-ruc" className="input num" inputMode="numeric" maxLength={11} placeholder={f.rucPh} {...register("ruc")} {...aria("ruc")} />
            {err("ruc")}
          </div>
          <div className="field">
            <label className="field__label" htmlFor="uf-phone">
              {f.phone} <span className="field__optional">{f.optional}</span>
            </label>
            <input id="uf-phone" className="input num" type="tel" placeholder={f.phonePh} {...register("phone")} {...aria("phone")} />
            {err("phone")}
          </div>
          {caps.statusInForm && (
            <div className="field">
              <label className="field__label" htmlFor="uf-status">
                {f.status}
              </label>
              <select id="uf-status" className="select" {...register("status")}>
                {(["pending", "active", "disabled"] as const).map((s) => (
                  <option key={s} value={s}>
                    {t.status[s]}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {kind === "staff" && (
          <fieldset className="user-form__roles" aria-describedby={errors.roles ? "uf-roles-error" : "uf-roles-hint"}>
            <legend className="field__label">{f.roles}</legend>
            <p className="field__hint" id="uf-roles-hint">
              {f.rolesHint}
            </p>
            <div className="role-options">
              {STAFF_ROLES.map((r) => (
                <label key={r} className="role-option">
                  <input type="checkbox" className="checkbox" value={r} {...register("roles")} />
                  <span>
                    <strong>{t.roles[r]}</strong>
                    <span>{t.roleText[r]}</span>
                  </span>
                </label>
              ))}
            </div>
            {err("roles")}
          </fieldset>
        )}

        <div className="field">
          <label className="field__label" htmlFor="uf-notes">
            {f.notes} <span className="field__optional">{f.optional}</span>
          </label>
          <textarea id="uf-notes" className="textarea" rows={2} placeholder={f.notesPh} {...register("notes")} />
        </div>

        {!editing && <p className="notice">{kind === "staff" ? f.inviteNote : f.customerNote}</p>}
      </form>
    </Dialog>
  );
}
