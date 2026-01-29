import { get, isObject } from "es-toolkit/compat";
import * as React from "react";
import { Link } from "react-router-dom";

import "@tanstack/react-table"; //or vue, svelte, solid, qwik, etc.
import { RowData } from "@tanstack/react-table";

declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    renderCell?: {
      type: string;
      path: string;
      payload: { link: string } | Record<string, any>;
    };
  }
}

interface TableTdProps {
  meta?: {
    type: string;
    path: string;
    payload: { link: string } | Record<string, any>;
  };
  original: Record<string, unknown>;
}

const typeMap = {
  text: TableTdText,
  link: TableTdLink,
  time: TableTdTime,
};

export function TableTd(props: TableTdProps) {
  const { meta, original } = props;
  const { type, path, payload } = meta ?? {};
  const value = get(original, path);
  const Component = typeMap[type] || TableTdText;
  return <Component {...payload} value={value} />;
}

export function TableTdText(props: { value: unknown }) {
  const { value } = props;
  if (isObject(value)) {
    return <div>{JSON.stringify(value)}</div>;
  }
  return <div>{value}</div>;
}

export function TableTdTime(props: {
  value: string;
  format: (time: string) => string;
}) {
  const { value, format } = props;
  if (!value) {
    return "-";
  }
  return <div>{format(value)}</div>;
}

export function TableTdLink(props: { value: unknown; link: string }) {
  const { value, link } = props;
  if (isObject(value)) {
    return <Link to={link}>{JSON.stringify(value)}</Link>;
  }
  return <Link to={link}>{value}</Link>;
}
