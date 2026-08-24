import { useEffect, useState } from "react";
import { createT, type Locale } from "@/i18n";
import { GlassModal } from "@/components/GlassModal";
import { Select } from "@/components/Select";
import { pathBasename } from "@/lib/attachments";
import {
  isCreateProjectWorkspace,
  type CreateProjectWorkspace,
} from "@/lib/projectWorkMode";

export type CreateProjectInput = {
  name: string;
  path: string;
  workspace: CreateProjectWorkspace;
};

export function folderPathFromDrop(files: FileList | null): string | null {
  if (!files?.length) return null;
  const file = files[0] as File & { path?: string };
  const raw = (file.path || "").trim();
  return raw || null;
}

export function CreateProjectModal(props: {
  locale: Locale;
  open: boolean;
  busy: boolean;
  error: string | null;
  /** Current Build / Office surface; Studio falls back to Build. */
  defaultWorkspace?: CreateProjectWorkspace;
  onClose: () => void;
  onPickFolder: () => Promise<string | null>;
  onCreate: (input: CreateProjectInput) => void;
}) {
  const tr = createT(props.locale);
  const defaultWorkspace = props.defaultWorkspace ?? "code";
  const [name, setName] = useState("");
  const [folder, setFolder] = useState<string | null>(null);
  const [workspace, setWorkspace] =
    useState<CreateProjectWorkspace>(defaultWorkspace);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (!props.open) return;
    setName("");
    setFolder(null);
    setWorkspace(defaultWorkspace);
    setPicking(false);
  }, [props.open, defaultWorkspace]);

  const pickFolder = async () => {
    if (props.busy || picking) return;
    setPicking(true);
    try {
      const path = await props.onPickFolder();
      if (!path) return;
      setFolder(path);
      setName((prev) => prev.trim() || pathBasename(path));
    } finally {
      setPicking(false);
    }
  };

  const submit = () => {
    if (props.busy || !folder) return;
    props.onCreate({
      name: name.trim() || pathBasename(folder),
      path: folder,
      workspace,
    });
  };

  return (
    <GlassModal
      open={props.open}
      onClose={() => {
        if (props.busy) return;
        props.onClose();
      }}
      title={tr("composer.createProject")}
      size="md"
      closeLabel={tr("common.close")}
      closeOnOverlay={!props.busy}
      showClose={!props.busy}
      wrapBody
      className="create-project-modal"
      footer={
        <>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={props.busy}
            onClick={props.onClose}
          >
            {tr("common.cancel")}
          </button>
          <button
            type="button"
            className="btn btn--solid"
            disabled={props.busy || !folder}
            onClick={submit}
          >
            {props.busy
              ? tr("composer.createProjectBusy")
              : tr("composer.createProject")}
          </button>
        </>
      }
    >
      <form
        className="create-project"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="create-project__field">
          <span className="create-project__label">
            {tr("composer.createProjectName")}
          </span>
          <input
            className="settings-input create-project__name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={tr("composer.createProjectNamePlaceholder")}
            autoComplete="off"
            autoFocus
            disabled={props.busy}
            spellCheck={false}
          />
        </label>
        <div className="create-project__field">
          <span className="create-project__label">
            {tr("composer.createProjectWorkspace")}
          </span>
          <Select
            className="create-project__workspace"
            value={workspace}
            disabled={props.busy}
            aria-label={tr("composer.createProjectWorkspace")}
            options={[
              {
                value: "code",
                label: tr("composer.createProjectWorkspaceBuild"),
              },
              {
                value: "office",
                label: tr("composer.createProjectWorkspaceOffice"),
              },
            ]}
            onChange={(value) => {
              if (isCreateProjectWorkspace(value)) setWorkspace(value);
            }}
          />
        </div>
        <div className="create-project__field">
          <span className="create-project__label">
            {tr("composer.createProjectFolders")}
          </span>
          {folder ? (
            <div className="create-project__picked">
              <span className="create-project__picked-name" title={folder}>
                {pathBasename(folder) || folder}
              </span>
              <button
                type="button"
                className="create-project__remove"
                disabled={props.busy}
                onClick={() => setFolder(null)}
              >
                {tr("composer.createProjectFolderRemove")}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="create-project__drop"
              disabled={props.busy || picking}
              onClick={() => {
                void pickFolder();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
              }}
              onDrop={(e) => {
                e.preventDefault();
                const path = folderPathFromDrop(e.dataTransfer.files);
                if (!path) {
                  void pickFolder();
                  return;
                }
                setFolder(path);
                setName((prev) => prev.trim() || pathBasename(path));
              }}
            >
              {tr("composer.createProjectFoldersHint")}
            </button>
          )}
        </div>
        {props.error ? (
          <p className="create-project__error" role="alert">
            {props.error}
          </p>
        ) : null}
      </form>
    </GlassModal>
  );
}
