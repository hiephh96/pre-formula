import * as _ from "lodash";
import { Schema, Node } from "prosemirror-model";
import { IToken, tokenMatcher, TokenType } from "chevrotain";
import { AstVisitor, AstVisitorContext, CubeDimensionAst, FunctionCallAst, PretationFunction, PretationLexer } from "@presightio/pretation-lang/src";
import { makePretationVocab } from "@presightio/pretation-lang/src";
import { mockAggregateSum, mockAverage, mockFirst, mockSum } from "@presightio/pretation-lang/test/MockedPretationFunction";
import { token } from "@presightio/pretation-lang/test/jestUtils";
import { fixtureBeforeAll, fixtureBeforeEach, parse } from "@presightio/pretation-lang/test";
import "@presightio/pretation-lang/test/jestUtils";
import { AbsoluteTimeSpecAst, Ast, BinaryOpAst, BinaryOperator, ExpressionAst, MetricAst, PeriodSpecAst, TimeDeltaOp, TimeDeltaSpecAst, TimeRangeSpecAst, TimeSpecAst, ValueAst } from "@presightio/pretation-ast/src";
import assert from "assert";
import { DataType, TickUnits } from "@presightio/common/src";

beforeAll(fixtureBeforeAll);
beforeEach(fixtureBeforeEach);

const vocab = makePretationVocab([
  mockAverage(),
  mockSum(),
  mockAggregateSum(),
  mockFirst(),
]);

const BINARY_OP_TOKEN_MAP: Record<BinaryOperator, TokenType> = {
  [BinaryOperator.PLUS_OP]: vocab.PlusOp,
  [BinaryOperator.MINUS_OP]: vocab.MinusOp,
  [BinaryOperator.TIMES_OP]: vocab.TimesOp,
  [BinaryOperator.DIV_OP]: vocab.DivOp,
  [BinaryOperator.POWER_OP]: vocab.PowerOp,
  [BinaryOperator.EQUALS_OP]: vocab.EqualsOp,
  [BinaryOperator.NOT_EQUAL_OP]: vocab.NotEqualOp,
  [BinaryOperator.GREATER_THAN_OR_EQUAL_OP]: vocab.GreaterThanOrEqualOp,
  [BinaryOperator.LESS_THAN_OR_EQUAL_OP]: vocab.LessThanOrEqualOp,
  [BinaryOperator.GREATER_THAN_OP]: vocab.GreaterThanOp,
  [BinaryOperator.LESS_THAN_OP]: vocab.LessThanOp,
  [BinaryOperator.CONCATENATE_OP]: vocab.ConcatenateOp,
  // [BinaryOperator.ILIKE_OP]: vocab,
  // [BinaryOperator.NOT_ILIKE_OP]: vocab.,
  // [BinaryOperator.LIKE_OP]: vocab.,
  // [BinaryOperator.NOT_LIKE_OP]: vocab.,
  // [BinaryOperator.IS]: vocab.,
}

const TIMEDELTA_OP_TOKEN_MAP: Record<TimeDeltaOp, TokenType> = {
  [TimeDeltaOp.PLUS]: vocab.PlusOp,
  [TimeDeltaOp.MINUS]: vocab.MinusOp,
}

class AstToTokenTransformer extends AstVisitor<Node, AstVisitorContext> {
  constructor(
    schema: Schema,
    metrics: Record<string, string>,
    dimensions: Record<string, string>,
    functionRegistry: Record<string, readonly PretationFunction[]>,
  ) {
    super(functionRegistry);
    this.addProcessor<ValueAst>(ast => ast instanceof ValueAst, (ast, context) => {
      const value = schema.nodes.token.create({tokenType: vocab.NumberLiteral.name}, schema.text(ast.formula));
      return schema.nodes.ast.create({astType: "ValueAst"}, value);
    });
    this.addProcessor<BinaryOpAst>(ast => ast instanceof BinaryOpAst, (ast, context) => {
      const left = this.visit(ast.left, context);
      const right = this.visit(ast.right, context);
      let tokenType = BINARY_OP_TOKEN_MAP[ast.operator];
      const op = schema.nodes.token.create({tokenType: tokenType.name}, schema.text(ast.operator));
      let nodes = [left, op, right];
      if ([BinaryOperator.TIMES_OP, BinaryOperator.DIV_OP].includes(ast.operator)) {
        const lefts = [left];
        const rights = [right];
        if (ast.left instanceof BinaryOpAst && [BinaryOperator.PLUS_OP, BinaryOperator.MINUS_OP].includes(ast.left.operator)) {
          // left = `(${left})`;
          const lparen = schema.nodes.token.create({tokenType: vocab.LParen.name}, schema.text("("));
          const rparen = schema.nodes.token.create({tokenType: vocab.RParen.name}, schema.text(")"));
          lefts.unshift(lparen);
          lefts.push(rparen);
        }
        if (ast.right instanceof BinaryOpAst && [BinaryOperator.PLUS_OP, BinaryOperator.MINUS_OP, BinaryOperator.DIV_OP].includes(ast.right.operator)) {
          const lparen = schema.nodes.token.create({tokenType: vocab.LParen.name}, schema.text("("));
          const rparen = schema.nodes.token.create({tokenType: vocab.RParen.name}, schema.text(")"));
          rights.unshift(lparen);
          rights.push(rparen);
        }
        nodes = [...lefts, op, ...rights];
      }
      return schema.nodes.ast.create({astType: "BinaryOpAst"}, nodes);
    });
    this.addProcessor<MetricAst>(ast => ast instanceof MetricAst, (ast, context) => {
      const name = metrics[ast.metricId];
      if (!name) throw new Error(`Metric not found: ${ast.metricId}`);
      const nameNode = schema.nodes.token.create({tokenType: vocab.Identifier.name}, schema.text(name));
      const lparen = schema.nodes.token.create({tokenType: vocab.LParen.name}, schema.text("("));
      const rparen = schema.nodes.token.create({tokenType: vocab.RParen.name}, schema.text(")"));
      const timeSpec = this.visit(ast.timeSpec, context);
      return schema.nodes.metric.create({metricId: ast.metricId}, [nameNode, lparen, timeSpec, rparen]);
    });
    this.addProcessor<TimeSpecAst>(ast => ast instanceof TimeSpecAst, (ast, context) => {
      const t = schema.nodes.token.create({tokenType: vocab.TOp.name}, schema.text("t"));
      const deltas = ast.timeDeltaSpecs.map(delta => this.visit(delta, context));
      return schema.nodes.ast.create({astType: "TimeSpecAst"}, [t, ...deltas]);
    });
    this.addProcessor<TimeRangeSpecAst>(ast => ast instanceof TimeRangeSpecAst, (ast, context) => {
      const start = this.visit(ast.start, context);
      const end = this.visit(ast.end, context);
      const rangeOp = schema.nodes.token.create({tokenType: vocab.RangeOp.name}, schema.text(":"));
      return schema.nodes.ast.create({astType: "TimeRangeSpecAst"}, [start, rangeOp, end]);
    });
    this.addProcessor<TimeDeltaSpecAst>(ast => ast instanceof TimeDeltaSpecAst, (ast, context) => {
      const opText = ast.op === TimeDeltaOp.PLUS ? "+" : "-";
      const opNode = schema.nodes.token.create({tokenType: TIMEDELTA_OP_TOKEN_MAP[ast.op].name}, schema.text(opText));
      const value = schema.nodes.token.create({tokenType: vocab.NumberLiteral.name}, schema.text(ast.period.value.toString()));
      const nodes = [opNode, value];
      if (ast.period.timeUnit != TickUnits.UNSPECIFIED) {
        const unit = schema.nodes.token.create({tokenType: "TickUnits"}, schema.text(ast.period.timeUnit));
        nodes.push(unit);
      }
      return schema.nodes.ast.create({astType: "TimeDeltaSpecAst"}, nodes);
    });
    this.addProcessor<AbsoluteTimeSpecAst>(ast => ast instanceof AbsoluteTimeSpecAst, (ast, context) => {
      const value = schema.nodes.token.create({tokenType: vocab.DateLiteral}, schema.text(ast.tick.toString()));
      return schema.nodes.ast.create({astType: "AbsoluteTimeSpecAst"}, [value]);
    });
    this.addProcessor<FunctionCallAst>(ast => ast instanceof FunctionCallAst, (ast, context) => {
      const name = schema.nodes.token.create({tokenType: vocab.Function.name}, schema.text(ast.func.name));
      const lparen = schema.nodes.token.create({tokenType: vocab.LParen.name}, schema.text("("));
      const rparen = schema.nodes.token.create({tokenType: vocab.RParen.name}, schema.text(")"));
      // const comma = schema.nodes.token.create({tokenType: vocab.Comma.name}, schema.text(","));
      const args = ast.args.map(arg => this.visit(arg, context));
      const nodes = [name, lparen];
      args.forEach((arg, i) => {
        nodes.push(arg);
        if (i < args.length - 1) {
          const comma = schema.nodes.token.create({tokenType: vocab.Comma.name}, schema.text(","));
          nodes.push(comma);
        }
      })
      nodes.push(rparen);
      return schema.nodes.function.create({functionId: ast.func.name}, nodes);
    });
    this.addProcessor<CubeDimensionAst>(ast => ast instanceof CubeDimensionAst, (ast, context) => {
      const dimId = ast.dimension.hashString();
      const name = dimensions[dimId];
      if (!name) throw new Error(`Dimension not found: ${dimId}`);
      const nameNode = schema.nodes.token.create({tokenType: vocab.Identifier.name}, schema.text(name));
      return schema.nodes.dimension.create({dimensionId: dimId}, [nameNode]);
    });
  }
}

const nodes = {
  doc: {
    content: "ast* | metric* | dimension* | token*"
  },
  ast: {
    attrs: {
      astType: { default: "" },
    },
    content: "ast* | token*",
  },
  metric: {
    attrs: {
      metricId: { default: "" },
    },
    content: "ast* | token*",
  },
  dimension: {
    attrs: {
      dimensionId: { default: "" },
    },
    content: "ast* | token*",
  },
  function: {
    attrs: {
      functionId: { default: "" },
    },
    content: "ast* | token*",
  },
  token: {
    attrs: {
      tokenType: { default: "" },
    },
    content: "text*",
  },
  text: {},
}
const schema = new Schema({nodes})
const metrics = {
  X: "X Full Name",
  A: "AA",
  B: "BB",
  C: "CC",
}
const dimensions = {
  "testws::Sales::Amount": "Sales Amount",
  "testws::Sales::Date": "Sales Date",
}

function docFromAst(ast: Ast): Node {
  const transformer = new AstToTokenTransformer(schema, metrics, dimensions, {});
  const eq = schema.nodes.token.create({tokenType: vocab.EqualsOp.name}, [schema.text("=")]);
  const astNodes = transformer.visit(ast, {});
  return schema.nodes.doc.create({}, [eq, astNodes]);
}

describe("create doc from formula", () => {
  test.each`
    formula   | expectedDocContent
    ${`=1+2`} | ${`=1+2`}
    ${`=(1+2)*3`} | ${`=(1+2)*3`}
    ${`=3*(4+5)`} | ${`=3*(4+5)`}
    ${`=(1+2)/(3-4)`} | ${`=(1+2)/(3-4)`}
    ${`=X(t)`} | ${`=X Full Name(t)`}
    ${`=A(t) + B(t-1) + C("2024-Q3")`} | ${`=AA(t)+BB(t-1)+CC(2024-Q3)`}
    ${`=SUM(A(t-3:t-1))`} | ${`=SUM(AA(t-3:t-1))`}
    ${`=SUM(Sales::Amount)`} | ${`=SUM(Sales Amount)`}
    ${`=SUM(Sales::Amount, Sales::Date)`} | ${`=SUM(Sales Amount,Sales Date)`}
    ${`=SUM(FIRST(testws::Sales::Amount)-FIRST(testws::Sales::Amount),testws::Sales::Date)`} | ${`=SUM(FIRST(Sales Amount)-FIRST(Sales Amount),Sales Date)`}
  `("$formula => $expectedDocContent", ({ formula, expectedDocContent }) => {
    const ast = parse(formula);
    assert(ast.ast);
    const doc = docFromAst(ast.ast);
    expect(doc.textContent).toEqual(expectedDocContent)
  })
})

function formulaFromDoc(doc: Node): string {
  // visit doc and build back formula string
  let formula = '';
  doc.descendants((node, pos, parent) => {
    if (node.type === schema.nodes.token) {
      if (parent && parent.type === schema.nodes.metric && node.attrs.tokenType === vocab.Identifier.name) {
        formula += parent.attrs.metricId;
      }
      else if (parent && parent.type === schema.nodes.dimension && node.attrs.tokenType === vocab.Identifier.name) {
        formula += parent.attrs.dimensionId;
      }
      else if (parent && parent.type === schema.nodes.ast && parent.attrs.astType === "AbsoluteTimeSpecAst") {
        formula += `"${node.textContent}"`;
      }
      else {
        formula += node.textContent;
      }
    }
  })
  return formula;
}

describe("formula from doc", () => {
  test.each`
    formula
    ${`=1+2`}
    ${`=X(t)`}
    ${`=A(t)+B(t-1)+C("2024-Q3")`}
    ${`=SUM(A(t-3:t-1))`}
    ${`=SUM(testws::Sales::Amount)`}
    ${`=SUM(testws::Sales::Amount,testws::Sales::Date)`}
    ${`=SUM(FIRST(testws::Sales::Amount)-FIRST(testws::Sales::Amount),testws::Sales::Date)`}
  `("$formula", ({ formula }) => {
    const ast = parse(formula);
    assert(ast.ast);
    const doc = docFromAst(ast.ast);
    const newFormula = formulaFromDoc(doc);
    expect(newFormula).toEqual(formula);
  })
})


/**
 * Generic constraints for a suggestion list
 */
interface SuggestionConstraint {
  get tokenType(): string;
  get contentQuery(): string;
}

/**
 * Provide enough information to bind the suggestion to a specific function call and argument index.
 * This is useful for providing argument suggestions, using the arg definition of the function itself.
 */
interface FunctionArgumentConstraint extends SuggestionConstraint {
  get functionId(): string;
  get precedingArguments(): Ast[];
  get argIndex(): number;
}

/**
 * Constraints for a dimension suggestion
 */
interface DimensionConstraint extends SuggestionConstraint {
  get reachableFromDimension(): string;
  get dataType(): DataType;
}

/**
 * An actual suggestion for a token
 */
interface Suggestion {
  // TODO
}

function suggest(doc: Node, pos: number): Suggestion[] {
  // const node = doc.nodeAt(pos);
  const resolvedPos = doc.resolve(pos);
  const path = _.rangeRight(resolvedPos.depth + 1).map(i => resolvedPos.node(i));
  const constraints: SuggestionConstraint[] = [];
  // TODO
  const suggestions: Suggestion[] = [];
  // TODO
  return suggestions;
}
