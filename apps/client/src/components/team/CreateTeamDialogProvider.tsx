import { CreateTeamDialog, type CreateTeamFormValues } from "@/components/team/CreateTeamDialog";
import { setLastTeamSlugOrId } from "@/lib/lastTeam";
import { stackClientApp } from "@/lib/stack";
import { api } from "@cmux/convex/api";
import { postApiTeams } from "@cmux/www-openapi-client";
import { useStackApp, useUser, type Team } from "@stackframe/react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

interface CreateTeamDialogOptions {
  initialValues?: Partial<CreateTeamFormValues>;
  onSuccess?: (result: { teamId: string; slug: string | null }) => void | Promise<void>;
}

interface CreateTeamDialogContextValue {
  open: (options?: CreateTeamDialogOptions) => void;
}

const CreateTeamDialogContext = createContext<CreateTeamDialogContextValue | null>(null);

export function CreateTeamDialogProvider({ children }: PropsWithChildren) {
  const navigate = useNavigate();
  const user = useUser({ or: "return-null" });
  const app = useStackApp();
  const upsertTeamPublic = useMutation(api.stack.upsertTeamPublic);
  const ensureMembershipPublic = useMutation(api.stack.ensureMembershipPublic);

  const [open, setOpen] = useState(false);
  const [initialValues, setInitialValues] = useState<Partial<CreateTeamFormValues> | undefined>();
  const optionsRef = useRef<CreateTeamDialogOptions | null>(null);

  const handleOpen = useCallback(
    (options?: CreateTeamDialogOptions) => {
      if (!user) {
        void stackClientApp.redirectToAccountSettings?.().catch(() => {
          const url = app.urls.accountSettings;
          void navigate({ to: url });
        });
        return;
      }

      optionsRef.current = options ?? null;
      if (options?.initialValues) {
        const { initialValues: provided } = options;
        setInitialValues({
          ...provided,
          inviteEmails: provided.inviteEmails ? [...provided.inviteEmails] : undefined,
        });
      } else {
        setInitialValues(undefined);
      }
      setOpen(true);
    },
    [app.urls.accountSettings, navigate, user]
  );

  const handleSubmit = useCallback(
    async (values: CreateTeamFormValues) => {
      const currentUser = user;
      if (!currentUser) {
        await stackClientApp.redirectToAccountSettings?.().catch(() => {
          const url = app.urls.accountSettings;
          void navigate({ to: url });
        });
        throw new Error("You must be signed in to create a team.");
      }

      try {
        const { data } = await postApiTeams({
          body: {
            displayName: values.displayName,
            slug: values.slug,
            inviteEmails: values.inviteEmails.length > 0 ? values.inviteEmails : undefined,
          },
          throwOnError: true,
        });

        await upsertTeamPublic({
          id: data.teamId,
          displayName: data.displayName,
          profileImageUrl: undefined,
          createdAtMillis: Date.now(),
        });
        await ensureMembershipPublic({ teamId: data.teamId, userId: currentUser.id });

        const timeoutAt = Date.now() + 15_000;
        let stackTeam: Team | null = null;
        while (Date.now() < timeoutAt) {
          stackTeam = await currentUser.getTeam(data.teamId);
          if (stackTeam) break;
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
        if (stackTeam) {
          await currentUser.setSelectedTeam(stackTeam);
        }

        const teamSlugOrId = data.slug ?? data.teamId;
        setLastTeamSlugOrId(teamSlugOrId);

        const options = optionsRef.current;
        if (options?.onSuccess) {
          await options.onSuccess({ teamId: data.teamId, slug: data.slug ?? null });
        } else {
          await navigate({
            to: "/$teamSlugOrId/dashboard",
            params: { teamSlugOrId },
          });
        }
      } catch (error) {
        const message =
          typeof error === "string"
            ? error
            : error instanceof Error
            ? error.message
            : error &&
              typeof error === "object" &&
              "message" in error &&
              typeof (error as { message?: unknown }).message === "string"
            ? ((error as { message: string }).message)
            : "Failed to create team";
        throw new Error(message);
      }
    },
    [app.urls.accountSettings, ensureMembershipPublic, navigate, upsertTeamPublic, user]
  );

  useEffect(() => {
    if (!open) {
      optionsRef.current = null;
      setInitialValues(undefined);
    }
  }, [open]);

  const contextValue = useMemo<CreateTeamDialogContextValue>(
    () => ({ open: handleOpen }),
    [handleOpen]
  );

  return (
    <CreateTeamDialogContext.Provider value={contextValue}>
      {children}
      <CreateTeamDialog
        open={open}
        onOpenChange={setOpen}
        onSubmit={handleSubmit}
        initialValues={initialValues}
      />
    </CreateTeamDialogContext.Provider>
  );
}

export function useCreateTeamDialog(): CreateTeamDialogContextValue {
  const context = useContext(CreateTeamDialogContext);
  if (!context) {
    throw new Error("useCreateTeamDialog must be used within a CreateTeamDialogProvider");
  }
  return context;
}
