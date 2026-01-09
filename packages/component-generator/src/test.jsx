import { get, set } from "es-toolkit/compat";
import * as React from "react";
import { useState } from "react";
import useSWR from "swr";
import { create } from "zustand";
const useCreateUserGraphStore = create(set => ({
  context: {
    name: ""
  },
  setContext: next => set(prev => ({
    ...prev,
    context: {
      ...(prev.context || {}),
      ...(next || {})
    }
  }))
}));
const actionCreateUserGraphDataSources = {
  "create-user": (payload, env) => {
    const url = "/api/users";
    const method = ("POST" || "GET").toUpperCase();
    const headers = undefined;
    const fetcher = env.fetch || fetch;
    const request = () => {
      if (method !== "GET") {
        return fetcher(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            ...(headers || {})
          },
          body: JSON.stringify(payload)
        }).then(res => res.json());
      }
      return fetcher(url, {
        method,
        headers: headers || undefined
      }).then(res => res.json());
    };
    return request();
  }
};
const createUserGraphDataSourceMode = {
  "create-user": "request"
};
const fetchCreateUser = url => fetch(url).then(res => res.json());
const useCreateUser = (options = {}) => useSWR(false ? "/api/users" : null, fetchCreateUser, {
  fallbackData: null,
  ...options
});
function PropCard(props) {
  const [text, setText] = useState(10);
  const {
    mutate: createUserMutate
  } = useCreateUser();
  const actionCreateUserGraphContext = useCreateUserGraphStore(state => state.context),
    setActionCreateUserGraphContext = useCreateUserGraphStore(state => state.setContext);
  const getActionCreateUserGraphPath = (target, path) => {
    if (!path) {
      return target;
    }
    return get(target, path);
  };
  const resolveActionCreateUserGraph = (value, event, context) => {
    if (value && typeof value === "object") {
      if (value.type === "event") {
        return getActionCreateUserGraphPath(event, value.path);
      }
      if (value.type === "context") {
        return getActionCreateUserGraphPath(context, value.path);
      }
    }
    return value;
  };
  const setActionCreateUserGraphPath = (target, path, value) => {
    const cleaned = String(path || "");
    if (!cleaned) {
      return value;
    }
    const base = target ? {
      ...target
    } : {};
    return set(base, cleaned, value);
  };
  const callActionCreateUserGraphDataSource = (dataSourceId, args, event, context) => {
    const resolvedArgs = (args || []).map(arg => resolveActionCreateUserGraph(arg, event, context));
    const payload = resolvedArgs.length <= 1 ? resolvedArgs[0] : resolvedArgs;
    const handler = actionCreateUserGraphDataSources[dataSourceId];
    if (!handler) {
      return undefined;
    }
    const createUserGraphDataSourceMutate = {
      "create-user": createUserMutate
    };
    const mode = createUserGraphDataSourceMode[dataSourceId];
    const env = {
      fetch,
      mutate: createUserGraphDataSourceMutate[dataSourceId]
    };
    const effect = () => handler(payload, env);
    if (env.mutate) {
      if (mode === "set") {
        return env.mutate(payload);
      }
      return env.mutate(effect, {
        revalidate: false
      });
    }
    return effect();
  };
  const dispatchActionCreateUserGraph = (actionId, event) => {
    let nextContext = actionCreateUserGraphContext;
    let changed = false;
    let result;
    switch (actionId) {
      case "INPUT_CHANGE":
        {
          nextContext = setActionCreateUserGraphPath(nextContext, "name", resolveActionCreateUserGraph({
            type: "event",
            path: "value"
          }, event, nextContext));
          changed = true;
          break;
        }
      case "SUBMIT":
        {
          result = callActionCreateUserGraphDataSource("create-user", [{
            type: "context",
            path: "name"
          }], event, nextContext);
          nextContext = setActionCreateUserGraphPath(nextContext, "name", "");
          changed = true;
          break;
        }
      default:
        break;
    }
    if (changed) {
      setActionCreateUserGraphContext(nextContext);
    }
    return result;
  };
  return <article className='prop-card'><header><h3>{props.TITLE}</h3><p>{props.SUBTITLE}</p></header><strong>{props.COUNT ?? (props.NAME ? 1 : 0)}</strong><div className='prop-body'><div>{"Action graph child"}</div></div></article>;
}
function Layout(props) {
  const {
    mutate: createUserMutate
  } = useCreateUser();
  const actionCreateUserGraphContext = useCreateUserGraphStore(state => state.context),
    setActionCreateUserGraphContext = useCreateUserGraphStore(state => state.setContext);
  const getActionCreateUserGraphPath = (target, path) => {
    if (!path) {
      return target;
    }
    return get(target, path);
  };
  const resolveActionCreateUserGraph = (value, event, context) => {
    if (value && typeof value === "object") {
      if (value.type === "event") {
        return getActionCreateUserGraphPath(event, value.path);
      }
      if (value.type === "context") {
        return getActionCreateUserGraphPath(context, value.path);
      }
    }
    return value;
  };
  const setActionCreateUserGraphPath = (target, path, value) => {
    const cleaned = String(path || "");
    if (!cleaned) {
      return value;
    }
    const base = target ? {
      ...target
    } : {};
    return set(base, cleaned, value);
  };
  const callActionCreateUserGraphDataSource = (dataSourceId, args, event, context) => {
    const resolvedArgs = (args || []).map(arg => resolveActionCreateUserGraph(arg, event, context));
    const payload = resolvedArgs.length <= 1 ? resolvedArgs[0] : resolvedArgs;
    const handler = actionCreateUserGraphDataSources[dataSourceId];
    if (!handler) {
      return undefined;
    }
    const createUserGraphDataSourceMutate = {
      "create-user": createUserMutate
    };
    const mode = createUserGraphDataSourceMode[dataSourceId];
    const env = {
      fetch,
      mutate: createUserGraphDataSourceMutate[dataSourceId]
    };
    const effect = () => handler(payload, env);
    if (env.mutate) {
      if (mode === "set") {
        return env.mutate(payload);
      }
      return env.mutate(effect, {
        revalidate: false
      });
    }
    return effect();
  };
  const dispatchActionCreateUserGraph = (actionId, event) => {
    let nextContext = actionCreateUserGraphContext;
    let changed = false;
    let result;
    switch (actionId) {
      case "INPUT_CHANGE":
        {
          nextContext = setActionCreateUserGraphPath(nextContext, "name", resolveActionCreateUserGraph({
            type: "event",
            path: "value"
          }, event, nextContext));
          changed = true;
          break;
        }
      case "SUBMIT":
        {
          result = callActionCreateUserGraphDataSource("create-user", [{
            type: "context",
            path: "name"
          }], event, nextContext);
          nextContext = setActionCreateUserGraphPath(nextContext, "name", "");
          changed = true;
          break;
        }
      default:
        break;
    }
    if (changed) {
      setActionCreateUserGraphContext(nextContext);
    }
    return result;
  };
  return <div className='layout'><input value={get(actionCreateUserGraphContext, ["name"]) ?? ""} placeholder={"Enter name"} onChange={event => {
      dispatchActionCreateUserGraph("INPUT_CHANGE", {
        value: event && event.target ? event.target.value : undefined,
        event
      });
    }} /><PropCard TITLE={get(actionCreateUserGraphContext, ["name"]) ?? "Anonymous"} SUBTITLE="Passed via context" NAME={get(actionCreateUserGraphContext, ["name"]) ?? ""} /><button className={"btn-primary"} disabled={false} onClick={event => {
      dispatchActionCreateUserGraph("SUBMIT", {
        event
      });
    }}>{"Add User"}</button>
    <div>{"Action Graph"}</div></div>;
}
export default Layout;