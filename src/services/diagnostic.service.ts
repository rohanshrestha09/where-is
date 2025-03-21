import * as acorn from "acorn";
import * as acornWalk from "acorn-walk";
import { ExtraUtil } from "../utils/extra.util";

export class DiagnosticService {
  private readonly cAST: acorn.Program;

  constructor(documentText: string, private readonly documentName: string) {
    this.cAST = acorn.parse(documentText, {
      ecmaVersion: "latest",
      sourceType: "script",
      locations: true,
    });
  }

  analyzeWarnings() {
    const warnings: {
      message: string;
      start: number;
      end: number;
    }[] = [];

    acornWalk.simple(this.cAST, {
      AssignmentExpression: (node: acorn.AssignmentExpression & acorn.Node) => {
        if (
          node.left.type === "MemberExpression" &&
          node.left.object.type === "Identifier" &&
          node.left.object.name === "internals" &&
          node.left.property.type === "Identifier" &&
          node.left.property.name === "controller"
        ) {
          const expectedName = ExtraUtil.convertToPascalCase(this.documentName);
          const isService = this.documentName.toLowerCase().endsWith("service");
          const isController = this.documentName
            .toLowerCase()
            .endsWith("controller");

          if (!isService && !isController) {
            return;
          }

          if (
            node.right.type === "ArrowFunctionExpression" ||
            node.right.type === "FunctionExpression"
          ) {
            const returnStatement =
              node.right.body.type === "BlockStatement"
                ? node.right.body.body.find((n) => n.type === "ReturnStatement")
                    ?.argument
                : node.right.body;

            const propertyName = isService ? "serviceName" : "controllerName";

            if (
              !returnStatement ||
              returnStatement.type !== "ObjectExpression" ||
              !returnStatement.properties.some(
                (prop) =>
                  prop.type === "Property" &&
                  prop.key.type === "Identifier" &&
                  prop.key.name === propertyName &&
                  prop.value.type === "Literal" &&
                  prop.value.value === expectedName
              )
            ) {
              warnings.push({
                message: `Recommended ${propertyName} as "${expectedName}"`,
                start: returnStatement?.start || node.right.start,
                end: returnStatement?.end || node.right.end,
              });
            }
          }
        }
      },
    });

    return warnings;
  }
}
