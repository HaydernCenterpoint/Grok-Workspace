/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import "@testing-library/jest-dom/vitest";
import "@/test/jsdomStubs";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  CreateProjectModal,
  folderPathFromDrop,
} from "@/components/workbench-modals/CreateProjectModal";

afterEach(cleanup);

function renderModal(
  overrides: Partial<ComponentProps<typeof CreateProjectModal>> = {},
) {
  const onCreate = vi.fn();
  const onPickFolder = vi.fn(async () => "/tmp/demo-app");
  render(
    <CreateProjectModal
      locale="en"
      open
      busy={false}
      error={null}
      defaultWorkspace="code"
      onClose={vi.fn()}
      onPickFolder={onPickFolder}
      onCreate={onCreate}
      {...overrides}
    />,
  );
  return { onCreate, onPickFolder };
}

describe("CreateProjectModal", () => {
  it("renders the create-project title, workspace field, and source-folder prompt", () => {
    renderModal();
    expect(
      screen.getByRole("heading", { name: "Create project" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Choose workspace" }),
    ).toHaveTextContent("Build");
    expect(
      screen.getByRole("button", {
        name: "Add a folder Grok can read and edit",
      }),
    ).toBeInTheDocument();
  });

  it("defaults Choose workspace to Office when the current surface is Office", () => {
    renderModal({ defaultWorkspace: "office" });
    expect(
      screen.getByRole("button", { name: "Choose workspace" }),
    ).toHaveTextContent("Office");
  });

  it("defaults Choose workspace to Build when the current surface is not Office", () => {
    renderModal({ defaultWorkspace: "code" });
    expect(
      screen.getByRole("button", { name: "Choose workspace" }),
    ).toHaveTextContent("Build");
  });

  it("creates into Build when the default workspace is left unchanged", async () => {
    const user = userEvent.setup();
    const { onCreate } = renderModal({ defaultWorkspace: "code" });
    await user.click(
      screen.getByRole("button", {
        name: "Add a folder Grok can read and edit",
      }),
    );
    expect(await screen.findByText("demo-app")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create project" }));
    expect(onCreate).toHaveBeenCalledWith({
      name: "demo-app",
      path: "/tmp/demo-app",
      workspace: "code",
    });
  });

  it("creates into Office when the dialog opened on that surface", async () => {
    const user = userEvent.setup();
    const { onCreate } = renderModal({ defaultWorkspace: "office" });
    await user.click(
      screen.getByRole("button", {
        name: "Add a folder Grok can read and edit",
      }),
    );
    expect(await screen.findByText("demo-app")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create project" }));
    expect(onCreate).toHaveBeenCalledWith({
      name: "demo-app",
      path: "/tmp/demo-app",
      workspace: "office",
    });
  });

  it("creates into Office when that workspace is chosen", async () => {
    const user = userEvent.setup();
    const { onCreate } = renderModal({ defaultWorkspace: "code" });
    await user.click(screen.getByRole("button", { name: "Choose workspace" }));
    const listbox = await screen.findByRole("listbox");
    await user.click(within(listbox).getByRole("button", { name: "Office" }));
    expect(
      screen.getByRole("button", { name: "Choose workspace" }),
    ).toHaveTextContent("Office");
    await user.click(
      screen.getByRole("button", {
        name: "Add a folder Grok can read and edit",
      }),
    );
    expect(await screen.findByText("demo-app")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create project" }));
    expect(onCreate).toHaveBeenCalledWith({
      name: "demo-app",
      path: "/tmp/demo-app",
      workspace: "office",
    });
  });

  it("reads a dropped folder path from the host File object", () => {
    const files = {
      length: 1,
      0: { path: "C:/src/demo-app", name: "demo-app" },
    } as unknown as FileList;
    expect(folderPathFromDrop(files)).toBe("C:/src/demo-app");
    expect(folderPathFromDrop(null)).toBeNull();
  });
});
