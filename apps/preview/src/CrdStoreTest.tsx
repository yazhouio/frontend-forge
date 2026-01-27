import { useEffect, useMemo, useState } from "react";
import { Button } from "@kubed/components";
import { getCrdStore } from "@frontend-forge/forge-components";

type DemoSpec = {
  flavor: string;
  replicas: number;
};

type DemoResource = {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace: string;
    resourceVersion?: string;
  };
  spec: DemoSpec;
};

type MockState = {
  items: Map<string, DemoResource>;
  version: number;
};

type MockWindow = Window & {
  __forgePreviewCrdMockInstalled?: boolean;
  __forgePreviewCrdMockState?: MockState;
  __forgePreviewCrdMockOriginalFetch?: typeof window.fetch;
};

const demoStore = getCrdStore({
  apiVersion: "v1alpha1",
  kind: "Demo",
  plural: "jsbundles",
  group: "extensions.kubesphere.io",
  kapi: false,
});

const namespace = "default";

const jsonHeaders = {
  "Content-Type": "application/json",
};

const defaultSpec = {
  flavor: "vanilla",
  replicas: 2,
};

function getMockState(win: MockWindow) {
  if (!win.__forgePreviewCrdMockState) {
    win.__forgePreviewCrdMockState = { items: new Map(), version: 1 };
  }
  return win.__forgePreviewCrdMockState;
}

function parseCrdPath(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "api" || parts[1] !== "forge.preview" || parts[2] !== "v1") {
    return null;
  }
  let index = 3;
  let resolvedNamespace = namespace;
  if (parts[index] === "namespaces") {
    resolvedNamespace = parts[index + 1] || namespace;
    index += 2;
  }
  const plural = parts[index];
  if (plural !== "demos") {
    return null;
  }
  const name = parts[index + 1];
  return { namespace: resolvedNamespace, name };
}

function buildJsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: jsonHeaders,
  });
}

function useResponseJson<T>(response?: Response) {
  const [data, setData] = useState<T | null>(null);

  useEffect(() => {
    let active = true;
    if (!response) {
      setData(null);
      return undefined;
    }
    response
      .clone()
      .json()
      .then((payload) => {
        if (active) {
          setData(payload as T);
        }
      })
      .catch(() => {
        if (active) {
          setData(null);
        }
      });
    return () => {
      active = false;
    };
  }, [response]);

  return data;
}

export function CrdStoreTest() {
  // useEffect(() => {
  //   installCrdMock();
  // }, []);

  const [name, setName] = useState("ff-test");
  const [flavor, setFlavor] = useState(defaultSpec.flavor);
  const [replicas, setReplicas] = useState(defaultSpec.replicas);
  const [lastAction, setLastAction] = useState("Waiting for action");
  const [actionError, setActionError] = useState<string | null>(null);

  const listStore = demoStore({});
  const detailStore = demoStore({
    params: {
      name: "ff-test-11",
    },
  });

  console.log("detailStore", detailStore.data);
  const listPayload = useResponseJson<{
    items?: DemoResource[];
  }>(listStore.data);
  const detailPayload = useResponseJson<DemoResource>(detailStore.data);

  const output = useMemo(() => {
    return {
      list: listPayload,
      detail: detailPayload,
    };
  }, [listPayload, detailPayload]);

  const handleCreate = async () => {
    setActionError(null);
    try {
      const res = await listStore.create({
        apiVersion: "v1",
        kind: "Demo",
        metadata: {
          name,
          namespace,
        },
        spec: { flavor, replicas },
      });
      const payload = await res.json();
      setLastAction(
        `Created ${payload?.metadata?.name} (rv ${payload?.metadata?.resourceVersion})`
      );
    } catch (err) {
      setActionError(String(err));
    }
  };

  const handleUpdate = async () => {
    setActionError(null);
    try {
      const res = await detailStore.update({
        apiVersion: "v1",
        kind: "Demo",
        metadata: {
          name,
          namespace,
        },
        spec: { flavor, replicas },
      });
      const payload = await res.json();
      setLastAction(
        `Updated ${payload?.metadata?.name} (rv ${payload?.metadata?.resourceVersion})`
      );
      await listStore.mutate();
    } catch (err) {
      setActionError(String(err));
    }
  };

  const handleDelete = async () => {
    setActionError(null);
    try {
      const res = await detailStore.delete(false);
      setLastAction(`Deleted ${name} (status ${res.status})`);
      await listStore.mutate();
    } catch (err) {
      setActionError(String(err));
    }
  };

  const listStatus = listStore.data
    ? `List ${listStore.data.status}`
    : listStore.isValidating
    ? "List loading"
    : "List idle";
  const detailStatus = detailStore.data
    ? `Detail ${detailStore.data.status}`
    : detailStore.isValidating
    ? "Detail loading"
    : "Detail idle";

  return (
    <section className="panel store-test">
      <div>
        <h2>CRD Store Test</h2>
        <p className="store-note">
          In-memory mock fetch for exercising getCrdStore create/update/delete.
        </p>
      </div>
      <div className="store-layout">
        <div className="store-card">
          <div className="store-controls">
            <label className="store-field">
              <span>Name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="store-field">
              <span>Flavor</span>
              <input
                value={flavor}
                onChange={(event) => setFlavor(event.target.value)}
              />
            </label>
            <label className="store-field">
              <span>Replicas</span>
              <input
                type="number"
                min={0}
                value={replicas}
                onChange={(event) => setReplicas(Number(event.target.value))}
              />
            </label>
          </div>
          <div className="store-actions">
            <Button.ForgeButton onClick={handleCreate}>
              Create
            </Button.ForgeButton>
            <Button.ForgeButton variant="ghost" onClick={handleUpdate}>
              Update
            </Button.ForgeButton>
            <Button.ForgeButton variant="ghost" onClick={handleDelete}>
              Delete
            </Button.ForgeButton>
          </div>
          <div className="store-status">
            <div>{listStatus}</div>
            <div>{detailStatus}</div>
            <div>{lastAction}</div>
            {actionError ? <div>{actionError}</div> : null}
          </div>
        </div>
        <div>
          <p className="store-note">Latest payloads</p>
          <pre className="store-output">{JSON.stringify(output, null, 2)}</pre>
        </div>
      </div>
    </section>
  );
}
