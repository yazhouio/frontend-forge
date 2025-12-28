import * as React from "react";
import { useState, useMemo } from "react";
import useSWR from "swr";
const fetchUsers = url => fetch(url).then(res => res.json());
const useUsers = (options = {}) => useSWR(true ? "/api/users" : null, fetchUsers, {
  fallbackData: [],
  ...options
});
const fetchPosts = url => fetch(url).then(res => res.json());
const usePosts = (options = {}) => useSWR(true ? "/api/posts" : null, fetchPosts, {
  fallbackData: [],
  ...options
});
function Layout(props) {
  const [text, setText] = useState(1);
  const [text_text_6, setText_text_6] = useState(6);
  const [text_text_7, setText_text_7] = useState(7);
  const columns = [{
      key: "name",
      title: "Name",
      mapper: value => value ? String(value).toUpperCase() : "-"
    }, {
      key: "email",
      title: "Email"
    }, {
      key: "role",
      title: "Role",
      mapper: (value, row) => row.active ? `${value} (active)` : value
    }],
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1),
    pageSize = 10,
    [tableLoading, setTableLoading] = useState(false);
  const baseUrl = "/api/users",
    buildUrl = (nextQuery, nextPage) => {
      const params = new URLSearchParams();
      if (nextQuery) {
        params.set("q", nextQuery);
      }
      params.set("page", String(nextPage));
      params.set("pageSize", String(pageSize));
      const queryString = params.toString();
      if (!queryString) {
        return baseUrl;
      }
      const joiner = baseUrl.includes("?") ? "&" : "?";
      return `${baseUrl}${joiner}${queryString}`;
    };
  const {
    data: userListData,
    error: userListError,
    isLoading: userListLoading,
    mutate: userListMutate
  } = useUsers();
  const {
    data: postsData,
    isLoading: postsLoading
  } = usePosts();
  const data = userListData ?? [],
    error = userListError ?? null,
    isLoading = userListLoading ?? false,
    mutate = userListMutate;
  const rows = (() => {
    if (!data) {
      return [];
    }
    if (Array.isArray(data)) {
      return data;
    }
    if (Array.isArray(data.items)) {
      return data.items;
    }
    if (Array.isArray(data.list)) {
      return data.list;
    }
    if (Array.isArray(data.data)) {
      return data.data;
    }
    return [];
  })();
  const total = (() => {
    if (!data) {
      return rows.length;
    }
    if (typeof data.total === "number") {
      return data.total;
    }
    if (typeof data.count === "number") {
      return data.count;
    }
    return rows.length;
  })();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const runFetch = (nextQuery, nextPage) => {
    const url = buildUrl(nextQuery, nextPage);
    setTableLoading(true);
    return Promise.resolve(mutate(() => fetch(url).then(res => res.json()), {
      revalidate: false
    })).finally(() => setTableLoading(false));
  };
  const onQueryChange = event => {
    const nextQuery = event.target.value;
    setQuery(nextQuery);
    setPage(1);
    runFetch(nextQuery, 1);
  };
  const onPrev = () => {
    const nextPage = Math.max(1, page - 1);
    if (nextPage === page) {
      return;
    }
    setPage(nextPage);
    runFetch(query, nextPage);
  };
  const onNext = () => {
    const nextPage = Math.min(totalPages, page + 1);
    if (nextPage === page) {
      return;
    }
    setPage(nextPage);
    runFetch(query, nextPage);
  };
  return <div className='layout'><section className='card'>
  <header>
    <h3>{"Welcome"}</h3>
    <p>{"Layout + Card"}</p>
  </header>
  <div className='card-body'><div>{userListData["0"] ?? "No users yet"}</div><div>{postsData["0"].title ?? "No posts yet"}</div><div>{postsLoading ?? false}</div><button className={"btn-primary"} disabled={false}>{"Primary Action"}</button><img src={"/assets/hero.png"} alt={"Hero image"} width={320} height={200} /><div className='table-node'>
  <div className='table-toolbar'>
    <input className='table-search' value={query} onChange={onQueryChange} placeholder={"Search users"} />
    <div className='table-meta'>
      {tableLoading || isLoading ? "Loading..." : error ? "Load failed" : `${total} items`}
    </div>
  </div>
  <div className='table-wrapper'>
    <table>
      <thead>
        <tr>
          {columns.map(col => <th key={col.key} style={col.width ? {
                    width: col.width
                  } : undefined}>
              {col.title}
            </th>)}
        </tr>
      </thead>
      <tbody>
        {rows.length ? rows.map((row, rowIndex) => <tr key={row.id ?? rowIndex}>
              {columns.map(col => <td key={col.key}>
                  {col.mapper ? col.mapper(row[col.key], row, rowIndex) : row[col.key]}
                </td>)}
            </tr>) : <tr>
            <td colSpan={columns.length}>
              {tableLoading || isLoading ? "Loading..." : "No data"}
            </td>
          </tr>}
      </tbody>
    </table>
  </div>
  <div className='table-pagination'>
    <button onClick={onPrev} disabled={page <= 1}>
      Prev
    </button>
    <span>
      Page {page} / {totalPages}
    </span>
    <button onClick={onNext} disabled={page >= totalPages}>
      Next
    </button>
  </div>
        </div></div>
    </section>
    <div>{"Hello Layout"}</div></div>;
}
