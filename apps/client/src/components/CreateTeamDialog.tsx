import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

export type CreateTeamErrorField = "displayName" | "slug" | "invites" | "general";

export class CreateTeamError extends Error {
  field?: CreateTeamErrorField;

  constructor(message: string, field?: CreateTeamErrorField) {
    super(message);
    this.name = "CreateTeamError";
    this.field = field;
  }
}

export interface CreateTeamFormValues {
  displayName: string;
  slug: string;
  invites: string[];
}

interface CreateTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (values: CreateTeamFormValues) => Promise<void>;
  isCreating: boolean;
}

const SLUG_MAX_LENGTH = 48;
const SLUG_MIN_LENGTH = 3;

function sanitizeSlugInput(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .slice(0, SLUG_MAX_LENGTH);
}

function slugifyName(value: string): string {
  return sanitizeSlugInput(value.replace(/['"]/g, ""));
}

function validateSlugFormat(slug: string): string | null {
  if (slug.length < SLUG_MIN_LENGTH || slug.length > SLUG_MAX_LENGTH) {
    return `Slug must be ${SLUG_MIN_LENGTH}–${SLUG_MAX_LENGTH} characters long`;
  }
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)) {
    return "Use lowercase letters, numbers, or hyphens. Start and end with a letter or number.";
  }
  return null;
}

export function CreateTeamDialog({
  open,
  onOpenChange,
  onCreate,
  isCreating,
}: CreateTeamDialogProps) {
  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [invitesRaw, setInvitesRaw] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setDisplayName("");
      setSlug("");
      setInvitesRaw("");
      setSlugEdited(false);
      setDisplayNameError(null);
      setSlugError(null);
      setGeneralError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!slugEdited) {
      const next = slugifyName(displayName);
      setSlug((current) => (current === next ? current : next));
    }
  }, [displayName, slugEdited]);

  const invitesHelperText = useMemo(
    () => "Comma or newline separated emails. We'll send invites after your team is created.",
    []
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isCreating) return;

    setGeneralError(null);

    const trimmedName = displayName.trim();
    if (!trimmedName) {
      setDisplayNameError("Enter a team name.");
      return;
    }

    const normalizedSlug = sanitizeSlugInput(slug);
    if (!normalizedSlug) {
      setSlugError("Enter a slug for your team.");
      return;
    }

    const slugValidation = validateSlugFormat(normalizedSlug);
    if (slugValidation) {
      setSlugError(slugValidation);
      return;
    }

    const invites = invitesRaw
      .split(/[\n,]/)
      .map((value) => value.trim())
      .filter((value, index, all) => value.length > 0 && all.indexOf(value) === index);

    try {
      await onCreate({
        displayName: trimmedName,
        slug: normalizedSlug,
        invites,
      });
      onOpenChange(false);
    } catch (error) {
      if (error instanceof CreateTeamError) {
        if (error.field === "displayName") {
          setDisplayNameError(error.message);
        } else if (error.field === "slug") {
          setSlugError(error.message);
        } else {
          setGeneralError(error.message);
        }
      } else {
        setGeneralError(
          "Something went wrong while creating your team. Please try again."
        );
      }
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isCreating) {
      return;
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-neutral-950/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-0 flex items-center justify-center p-4">
          <div
            className={cn(
              "relative w-full max-w-lg overflow-hidden rounded-2xl border",
              "border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-950"
            )}
          >
            <form onSubmit={handleSubmit} className="flex flex-col">
              <header className="flex items-start justify-between gap-4 px-6 pt-6">
                <div>
                  <Dialog.Title className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                    Create a team
                  </Dialog.Title>
                  <Dialog.Description className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                    Name your workspace, choose a slug, and invite teammates.
                  </Dialog.Description>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenChange(false)}
                  className="rounded-full p-1 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                  disabled={isCreating}
                  aria-label="Close create team dialog"
                >
                  <X className="size-4" />
                </button>
              </header>

              {generalError ? (
                <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300">
                  {generalError}
                </div>
              ) : null}

              <div className="px-6 py-5 space-y-5">
                <div>
                  <label
                    htmlFor="create-team-name"
                    className="block text-sm font-medium text-neutral-800 dark:text-neutral-200"
                  >
                    Team name
                  </label>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    How your team appears across cmux.
                  </p>
                  <input
                    id="create-team-name"
                    name="teamName"
                    type="text"
                    autoFocus
                    value={displayName}
                    onChange={(event) => {
                      setDisplayName(event.target.value);
                      if (displayNameError) setDisplayNameError(null);
                      if (generalError) setGeneralError(null);
                    }}
                    placeholder="Acme Corp"
                    aria-invalid={displayNameError ? true : undefined}
                    aria-describedby={displayNameError ? "create-team-name-error" : undefined}
                    className={cn(
                      "mt-2 w-full rounded-lg border px-3 py-2 text-sm transition",
                      "bg-white text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:ring-neutral-100/20",
                      displayNameError
                        ? "border-red-500 focus:ring-red-500/30"
                        : "border-neutral-300 dark:border-neutral-700"
                    )}
                    disabled={isCreating}
                  />
                  {displayNameError ? (
                    <p
                      id="create-team-name-error"
                      className="mt-2 text-xs text-red-600 dark:text-red-400"
                    >
                      {displayNameError}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label
                    htmlFor="create-team-slug"
                    className="block text-sm font-medium text-neutral-800 dark:text-neutral-200"
                  >
                    Team slug
                  </label>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    Appears in the URL, for example <span className="font-mono text-xs">/{slug || "your-team"}/dashboard</span>.
                  </p>
                  <input
                    id="create-team-slug"
                    name="teamSlug"
                    type="text"
                    value={slug}
                    onChange={(event) => {
                      setSlugEdited(true);
                      const next = sanitizeSlugInput(event.target.value);
                      setSlug(next);
                      if (slugError) setSlugError(null);
                      if (generalError) setGeneralError(null);
                    }}
                    placeholder="acme"
                    aria-invalid={slugError ? true : undefined}
                    aria-describedby={slugError ? "create-team-slug-error" : undefined}
                    className={cn(
                      "mt-2 w-full rounded-lg border px-3 py-2 text-sm transition",
                      "bg-white text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:ring-neutral-100/20",
                      slugError
                        ? "border-red-500 focus:ring-red-500/30"
                        : "border-neutral-300 dark:border-neutral-700"
                    )}
                    disabled={isCreating}
                  />
                  {slugError ? (
                    <p
                      id="create-team-slug-error"
                      className="mt-2 text-xs text-red-600 dark:text-red-400"
                    >
                      {slugError}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label
                    htmlFor="create-team-invites"
                    className="block text-sm font-medium text-neutral-800 dark:text-neutral-200"
                  >
                    Invite teammates (optional)
                  </label>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    {invitesHelperText}
                  </p>
                  <textarea
                    id="create-team-invites"
                    name="teamInvites"
                    value={invitesRaw}
                    onChange={(event) => {
                      setInvitesRaw(event.target.value);
                      if (generalError) setGeneralError(null);
                    }}
                    rows={3}
                    placeholder="teammate@example.com, partner@example.com"
                    className="mt-2 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:ring-neutral-100/20"
                    disabled={isCreating}
                  />
                </div>
              </div>

              <footer className="flex items-center justify-between gap-3 border-t border-neutral-200 bg-neutral-50 px-6 py-4 dark:border-neutral-800 dark:bg-neutral-950/80">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleOpenChange(false)}
                  disabled={isCreating}
                  className="text-neutral-700 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isCreating} className="min-w-[120px]">
                  {isCreating ? "Creating…" : "Create team"}
                </Button>
              </footer>
            </form>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
