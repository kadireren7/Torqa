import { PolicyPackEditorClient } from "./pack-editor-client";

export const metadata = {
  title: "Policy pack editor",
};

type RouteContext = { params: Promise<{ id: string }> };

export default async function PolicyPackEditorPage(context: RouteContext) {
  const { id } = await context.params;
  return <PolicyPackEditorClient packId={id} />;
}
