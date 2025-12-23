import { Engine } from "./index";
import { Button, Create, Page, Text } from "../nodes";
import type { PageSchema } from "../nodes/interfaces";

const schema: PageSchema = {
  version: "1.0",
  // dataSources: [
  //   {
  //     id: "users",
  //     type: "http",
  //     config: {
  //       url: "/api/users",
  //     },
  //   },
  // ],
  root: {
    id: "Page",
    type: "Page",
    props: { name: "page", value: 1 },
    children: [
      {
        id: "Div1",
        type: "div",
        props: { className: "'div1'" },
        children: [
          {
            id: "Create",
            type: "Create",
            props: { className: "'create'" },
          },
        ],
      },
      {
        id: "Div2",
        type: "div",
        props: { className: "'div2'" },
        children: [
          {
            id: "Text",
            type: "Text",
            props: { text: "text1" },
          },
        ],
      },
    ],
  },
};

const code = new Engine()
  .registerNode(new Page())
  .registerNode(new Button())
  .registerNode(new Text())
  .registerNode(new Create())
  .compile(schema);
console.log(code);
