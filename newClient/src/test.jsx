import * as React from "react";
import { useState } from "react";
import useSWR from "swr";
const fetchCreateUser = (url) => fetch(url).then((res) => res.json());
const useCreateUser = (options = {}) =>
  useSWR(false ? "/api/users" : null, fetchCreateUser, {
    fallbackData: null,
    ...options,
  });
function Layout(props) {
  const [actionCreateUserGraphContext, setActionCreateUserGraphContext] =
    useState({
      name: "",
    });
  const { mutate: createUserMutate } = useCreateUser();
  const getActionCreateUserGraphPath = (target, path) => {
    if (!path) {
      return target;
    }
    const parts = path.split(".").filter(Boolean);
    return parts.reduce(
      (acc, key) => (acc == null ? undefined : acc[key]),
      target
    );
  };
  const resolveActionCreateUserGraph = (value, event, context) => {
    if (typeof value !== "string") {
      return value;
    }
    if (value.startsWith("$event")) {
      const eventPath = value.slice(6);
      const normalized = eventPath.startsWith(".")
        ? eventPath.slice(1)
        : eventPath;
      return getActionCreateUserGraphPath(event, normalized);
    }
    if (value.startsWith("context")) {
      const contextPath = value.slice(7);
      const normalized = contextPath.startsWith(".")
        ? contextPath.slice(1)
        : contextPath;
      return getActionCreateUserGraphPath(context, normalized);
    }
    return value;
  };
  const setActionCreateUserGraphPath = (target, path, value) => {
    const cleaned = String(path || "").replace(/^context\.?/, "");
    if (!cleaned) {
      return value;
    }
    const parts = cleaned.split(".").filter(Boolean);
    const result = Array.isArray(target)
      ? [...target]
      : {
          ...(target || {}),
        };
    let cursor = result;
    for (let index = 0; index < parts.length - 1; index += 1) {
      const key = parts[index];
      const prev = cursor[key];
      const next =
        prev && typeof prev === "object"
          ? Array.isArray(prev)
            ? [...prev]
            : {
                ...prev,
              }
          : {};
      cursor[key] = next;
      cursor = next;
    }
    cursor[parts[parts.length - 1]] = value;
    return result;
  };
  const callActionCreateUserGraphDataSource = (
    dataSourceId,
    args,
    event,
    context
  ) => {
    const resolvedArgs = (args || []).map((arg) =>
      resolveActionCreateUserGraph(arg, event, context)
    );
    const payload = resolvedArgs.length <= 1 ? resolvedArgs[0] : resolvedArgs;
    switch (dataSourceId) {
      case "create-user": {
        const url = "/api/users";
        const method = ("POST" || "GET").toUpperCase();
        const headers = undefined;
        if (method !== "GET") {
          return createUserMutate(
            () =>
              fetch(url, {
                method,
                headers: {
                  "Content-Type": "application/json",
                  ...(headers || {}),
                },
                body: JSON.stringify(payload),
              }).then((res) => res.json()),
            {
              revalidate: false,
            }
          );
        }
        return createUserMutate(
          () =>
            fetch(url, {
              method,
              headers: headers || undefined,
            }).then((res) => res.json()),
          {
            revalidate: false,
          }
        );
      }
    }
    return undefined;
  };
  const dispatchActionCreateUserGraph = (actionId, event) => {
    let nextContext = actionCreateUserGraphContext;
    let changed = false;
    let result;
    switch (actionId) {
      case "INPUT_CHANGE": {
        nextContext = setActionCreateUserGraphPath(
          nextContext,
          "context.name",
          resolveActionCreateUserGraph("$event.value", event, nextContext)
        );
        changed = true;
        break;
      }
      case "SUBMIT": {
        result = callActionCreateUserGraphDataSource(
          "create-user",
          ["context.name"],
          event,
          nextContext
        );
        nextContext = setActionCreateUserGraphPath(
          nextContext,
          "context.name",
          ""
        );
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
  return (
    <div className="layout">
      <input
        value={actionCreateUserGraphContext.name ?? ""}
        placeholder={"Enter name"}
        onChange={(event) => {
          dispatchActionCreateUserGraph("INPUT_CHANGE", {
            value: event && event.target ? event.target.value : undefined,
            event,
          });
        }}
      />
      <button
        className={"btn-primary"}
        disabled={false}
        onClick={(event) => {
          dispatchActionCreateUserGraph("SUBMIT", {
            event,
          });
        }}
      >
        {"Add User"}
      </button>
      <div>{"Action Graph"}</div>
    </div>
  );
}
