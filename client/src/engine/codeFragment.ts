import type { ExpressionStatement, Module, Statement } from "@swc/core";
import swc from "@swc/core";
import { ImportManager } from "../import";
import type {
  CodeFragmentIR,
  FunctionIR,
  StatementWithMeta,
} from "./interfaces";
import { HookSemantic, StatementScope } from "./interfaces";
import type { LooseCodeFragmentIR } from "../nodes/interfaces";
import { FunctionIRBuilder } from "./functionIRBuilder";
import { transformFunctionIR } from "../tools/transformFunctionIR";
import { DUMMY_SPAN } from "./constants";
import { DEFAULT_SWC_PARSE_OPTIONS } from "../tools/swcParseOptions";

export class CodeFragment implements CodeFragmentIR {
  imports: ImportManager = new ImportManager();

  moduleDecls: StatementWithMeta[] = [];

  moduleInits: StatementWithMeta[] = [];

  functions: FunctionIR[] = [];

  static toAst(codeFragment: CodeFragmentIR): Statement[] {
    return [
      ...(codeFragment.moduleDecls?.map((stmt) => stmt.stmt) || []),
      ...(codeFragment.moduleInits?.map((stmt) => stmt.stmt) || []),
      ...(codeFragment.functions?.flatMap((stmt) =>
        transformFunctionIR(stmt)
      ) || []),
    ];
  }
  static generateCode(codeFragment: CodeFragmentIR): string {
    const imports = codeFragment.imports.parse().visitor().toString();
    const body = swc.printSync(
      {
        type: "Module",
        span: DUMMY_SPAN,
        body: CodeFragment.toAst(codeFragment),
      } as Module,
      {
        jsc: {
          parser: {
            syntax: "typescript",
            tsx: true,
            dynamicImport: true,
          },
        },
      }
    );
    return imports + "\n\n" + body.code;
  }

  static fromLooseCodeFragmentGroup(
    looseCodeFragment: LooseCodeFragmentIR
  ): CodeFragmentIR {
    const imports = new ImportManager(looseCodeFragment.imports);
    const moduleDecls: StatementWithMeta[] = [];
    const moduleInits: StatementWithMeta[] = [];
    const functions: FunctionIR[] = [];
    const functionBodyIRs: StatementWithMeta[] = [];

    looseCodeFragment.statementsWithMeta?.forEach((stmt) => {
      switch (stmt.scope) {
        case StatementScope.ModuleDecl:
          moduleDecls.push(stmt);
          break;
        case StatementScope.ModuleInit:
          moduleInits.push(stmt);
          break;
        case StatementScope.FunctionBody:
          functionBodyIRs.push(stmt);
          break;
      }
    });

    if (functionBodyIRs.length) {
      const functionIRBuilder = new FunctionIRBuilder();
      functionIRBuilder.setDecl(looseCodeFragment.meta.nodeName);
      functionBodyIRs.forEach((stmt) => {
        functionIRBuilder.addBody(stmt);
      });
      if (looseCodeFragment.jsx) {
        functionIRBuilder.addReturn({
          stmt:
            typeof looseCodeFragment.jsx === "string"
              ? {
                  span: DUMMY_SPAN,
                  type: "ReturnStatement",
                  argument: (
                    swc.parseSync(
                      looseCodeFragment.jsx,
                      DEFAULT_SWC_PARSE_OPTIONS
                    ).body[0] as ExpressionStatement
                  ).expression,
                }
              : looseCodeFragment.jsx,
          scope: StatementScope.FunctionBody,
          hook: HookSemantic.None,
          reorderable: true,
          owner: `${looseCodeFragment.meta.nodeName}Return`,
        });
      }
      functions.push(functionIRBuilder.build());
    }

    return {
      imports,
      moduleDecls,
      moduleInits,
      functions,
    };
  }
}
