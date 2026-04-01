import inspect
import json
import re
import sys
from enum import Enum
from typing import Any, Collection, Dict, List, Optional, Set, Tuple, Union

from src.semantics.ir_semantics import build_ir_semantic_report, default_ir_function_registry
from src.execution.engine_routing import compare_rust_and_python_pipeline, run_rust_pipeline_with_fallback
from src.orchestrator.platform_controller import PlatformController
from src.execution.ir_execution import (
    IRExecutionResult,
    IRExecutionContext,
    default_ir_runtime_impls,
    execute_ir_goal,
    ir_execution_plan_to_json,
    ir_execution_result_to_json,
)
from src.projection.projection_strategy import (
    analyze_ir_domains,
    choose_projection_targets,
    projection_plan_to_json,
    validate_projection_plan,
)
from src.orchestrator.system_orchestrator import (
    SystemOrchestrator,
    generate_all_targets,
    orchestrator_to_json,
)
from src.control.capability_registry import build_capability_registry, build_system_manifest, resolve_preferred_engine
from src.control.ir_mutation import IRMutation, apply_ir_mutation_batch, compute_ir_diff
from src.control.ir_optimizer import optimize_ir_goal_with_report
from src.evolution.self_evolution import evolve_ir
from src.evolution.self_hosting import (
    build_internal_ir_library,
    execute_internal_ir_library,
    project_internal_ir_library,
    system_to_ir_description,
    validate_internal_ir_consistency,
)
from src.app.internal_application_shell import (
    InternalApplicationShell,
    build_checkpoint_package,
    validate_git_checkpoint_readiness,
    website_success_gate,
)
from src.codegen.artifact_builder import (
    build_generation_plan,
    can_generate_simple_website,
    validate_generated_artifacts,
)

from src.ir.canonical_ir import (
    IRBinary,
    IRCall,
    IRCondition,
    IRExpr,
    IRGoal,
    IRIdentifier,
    IRInput,
    IRLogical,
    IRNumberLiteral,
    IRStringLiteral,
    IRTransition,
    compute_ir_fingerprint,
    export_ir_bundle,
    export_ir_bundle_json,
    ir_goal_to_json,
    normalize_ir_goal,
    validate_export_bundle,
    validate_ir,
    validate_ir_handoff_compatibility,
    validate_ir_semantic_determinism,
)

# --- V0.6: Turkish surface → English canonical (normalization) --------------------------------

TR_TO_EN_TYPES: Dict[str, str] = {
    "metin": "text",
    "sayi": "number",
    "boolean": "boolean",
}

TR_TO_EN_FUNCTIONS: Dict[str, str] = {
    "mevcut": "exists",
    "kullanici_adi_dogru": "verify_username",
    "sifre_dogru": "verify_password",
    "kullanici_hesap_durumu": "user_account_status",
    "ip_adresi_kara_liste": "ip_blacklisted",
    "giris_basarili_kayit": "log_successful_login",
    "sifre_hatali_deneme_sayisi_sifirla": "reset_failed_attempts",
    "oturum_baslat": "start_session",
}

TR_TO_EN_IDENTIFIERS: Dict[str, str] = {
    "kullanici_adi": "username",
    "sifre": "password",
    "ip_adresi": "ip_address",
    "son_giris_ip": "last_login_ip",
    "hatali_giris_denemesi_sayisi": "failed_login_count",
}

EN_TO_TR_IDENTIFIERS: Dict[str, str] = {
    v: k for k, v in TR_TO_EN_IDENTIFIERS.items()
}

TR_TO_EN_LOGICAL_OPS: Dict[str, str] = {"ve": "and", "veya": "or"}

TR_TO_EN_GOALS: Dict[str, str] = {
    "KullaniciGirisAkisi": "UserLoginFlow",
}

TR_TO_EN_RESULT_STRINGS: Dict[str, str] = {
    "Giriş Başarılı": "Login Successful",
}

TR_TO_EN_STRING_VALUES: Dict[str, str] = {
    "kilitli": "locked",
}


# --- Types (semantic core) --------------------------------------------------------------------

class Type:
    __slots__ = ()

    def __eq__(self, other: object) -> bool:
        return type(self) is type(other)

    def __hash__(self) -> int:
        return hash(type(self))


class TextType(Type):
    __slots__ = ()


class NumberType(Type):
    __slots__ = ()


class BooleanType(Type):
    __slots__ = ()


class VoidType(Type):
    """Return type for side-effect (transition) calls."""
    __slots__ = ()


class AnyBoundInputType(Type):
    """Placeholder: argument must be a declared input; type comes from input declaration."""
    __slots__ = ()


def type_from_input_keyword(tip: str) -> Type:
    if tip == "text":
        return TextType()
    if tip == "number":
        return NumberType()
    if tip == "boolean":
        return BooleanType()
    raise ValueError(f"Unknown input type: {tip!r}")


def type_label(t: Optional[Type]) -> str:
    if t is None:
        return "unknown"
    if isinstance(t, TextType):
        return "text"
    if isinstance(t, NumberType):
        return "number"
    if isinstance(t, BooleanType):
        return "boolean"
    if isinstance(t, VoidType):
        return "void"
    if isinstance(t, AnyBoundInputType):
        return "bound_input"
    return type(t).__name__


# --- Function registry ------------------------------------------------------------------------


class AfterGuaranteeSpec:
    """
    Declarative after-state guarantee from a transition, tied to a call argument (Identifier).
    guarantee_type: \"exists\" | \"equals\" (canonical English).
    """

    def __init__(
        self,
        identifier_source_index: Optional[int] = None,
        guarantee_type: Optional[str] = None,
        equals_literal: Any = None,
    ):
        self.identifier_source_index = identifier_source_index
        self.guarantee_type = guarantee_type or "exists"
        self.equals_literal = equals_literal


class FunctionSignature:
    def __init__(
        self,
        name: str,
        arg_types: List[Type],
        return_type: Type,
        reads: Optional[Collection[str]] = None,
        writes: Optional[Collection[str]] = None,
        guarantees_after: Optional[List[AfterGuaranteeSpec]] = None,
    ):
        self.name = name
        self.arg_types = arg_types
        self.return_type = return_type
        self.reads: Optional[Set[str]] = set(reads) if reads is not None else None
        self.writes: Optional[Set[str]] = set(writes) if writes is not None else None
        self.guarantees_after: List[AfterGuaranteeSpec] = (
            list(guarantees_after) if guarantees_after is not None else []
        )


def default_function_registry() -> Dict[str, FunctionSignature]:
    """Built-in signatures (canonical English names)."""
    T, N, B, V = TextType(), NumberType(), BooleanType(), VoidType()
    AB = AnyBoundInputType()
    return {
        "exists": FunctionSignature("exists", [AB], B),
        "verify_username": FunctionSignature("verify_username", [T], B),
        "verify_password": FunctionSignature("verify_password", [T, T], B),
        "user_account_status": FunctionSignature("user_account_status", [T], T),
        "ip_blacklisted": FunctionSignature("ip_blacklisted", [T], B),
        "log_successful_login": FunctionSignature(
            "log_successful_login",
            [T, T],
            V,
            reads={"username", "ip_address"},
            writes={"audit_log"},
            guarantees_after=[
                AfterGuaranteeSpec(0, "exists"),
                AfterGuaranteeSpec(1, "exists"),
            ],
        ),
        "reset_failed_attempts": FunctionSignature(
            "reset_failed_attempts",
            [T],
            V,
            reads={"username"},
            writes={"failed_login_count"},
            guarantees_after=[AfterGuaranteeSpec(0, "exists")],
        ),
        "start_session": FunctionSignature(
            "start_session",
            [T],
            V,
            reads={"username"},
            writes={"session_user"},
            guarantees_after=[AfterGuaranteeSpec(0, "exists")],
        ),
    }


# --- Expression AST ---------------------------------------------------------------------------

class Expr:
    pass


class Identifier(Expr):
    def __init__(self, name: str, type: Optional[Type] = None):
        self.name = name
        self.type = type


class StringLiteral(Expr):
    def __init__(self, value: str):
        self.value = value


class NumberLiteral(Expr):
    def __init__(self, value: Union[int, float]):
        self.value = value


class FunctionCall(Expr):
    def __init__(self, name: str, args: List[Expr]):
        self.name = name
        self.args = args


class BinaryOp(Expr):
    def __init__(self, left: Expr, op: str, right: Expr):
        self.left = left
        self.op = op
        self.right = right


class LogicalOp(Expr):
    def __init__(self, left: Expr, op: str, right: Expr):
        self.left = left
        self.op = op
        self.right = right


def normalize_expr_inplace(expr: Expr) -> None:
    if isinstance(expr, Identifier):
        expr.name = TR_TO_EN_IDENTIFIERS.get(expr.name, expr.name)
    elif isinstance(expr, StringLiteral):
        expr.value = TR_TO_EN_STRING_VALUES.get(expr.value, expr.value)
    elif isinstance(expr, FunctionCall):
        expr.name = TR_TO_EN_FUNCTIONS.get(expr.name, expr.name)
        for a in expr.args:
            normalize_expr_inplace(a)
    elif isinstance(expr, BinaryOp):
        normalize_expr_inplace(expr.left)
        normalize_expr_inplace(expr.right)
    elif isinstance(expr, LogicalOp):
        expr.op = TR_TO_EN_LOGICAL_OPS.get(expr.op, expr.op)
        normalize_expr_inplace(expr.left)
        normalize_expr_inplace(expr.right)


def normalize_ast(raw: dict) -> dict:
    """Parser output (Turkish keys, tokens) → canonical English AST dict."""
    goal = raw.get("hedef")
    if goal:
        goal = TR_TO_EN_GOALS.get(goal, goal)

    inputs_en: Dict[str, str] = {}
    for row in raw.get("girdi") or []:
        tr_n = row["ad"]
        tr_t = row["tip"]
        en_n = TR_TO_EN_IDENTIFIERS.get(tr_n, tr_n)
        en_t = TR_TO_EN_TYPES.get(tr_t, tr_t)
        inputs_en[en_n] = en_t

    requires: List[Expr] = []
    for e in raw.get("gerektirir") or []:
        if isinstance(e, Expr):
            normalize_expr_inplace(e)
            requires.append(e)

    forbids: List[Expr] = []
    for e in raw.get("yasaklar") or []:
        if isinstance(e, Expr):
            normalize_expr_inplace(e)
            forbids.append(e)

    effects: List[FunctionCall] = []
    for e in raw.get("etkiler") or []:
        if isinstance(e, FunctionCall):
            normalize_expr_inplace(e)
            effects.append(e)

    result = raw.get("sonuç")
    if result:
        result = TR_TO_EN_RESULT_STRINGS.get(result, result)

    return {
        "goal": goal,
        "inputs": inputs_en,
        "requires": requires,
        "forbids": forbids,
        "effects": effects,
        "result": result,
    }


def infer_type(
    expr: Expr,
    symbol_table: Dict[str, Type],
    function_registry: Dict[str, FunctionSignature],
) -> Optional[Type]:
    if isinstance(expr, Identifier):
        return symbol_table.get(expr.name)

    if isinstance(expr, StringLiteral):
        return TextType()

    if isinstance(expr, NumberLiteral):
        return NumberType()

    if isinstance(expr, FunctionCall):
        sig = function_registry.get(expr.name)
        return sig.return_type if sig else None

    if isinstance(expr, BinaryOp):
        return BooleanType()

    if isinstance(expr, LogicalOp):
        return BooleanType()

    return None


def _arg_type_matches(
    arg_expr: Expr,
    expected: Type,
    symbol_table: Dict[str, Type],
    function_registry: Dict[str, FunctionSignature],
) -> Tuple[bool, Optional[Type]]:
    """Whether argument matches expected type; returns (ok, inferred_type)."""
    if isinstance(expected, AnyBoundInputType):
        if not isinstance(arg_expr, Identifier):
            return False, None
        t = symbol_table.get(arg_expr.name)
        return (t is not None), t

    actual = infer_type(arg_expr, symbol_table, function_registry)
    if actual is None:
        return False, None
    return actual == expected, actual


def attach_identifier_types(expr: Expr, symbol_table: Dict[str, Type]) -> None:
    """Attach types from symbol table to identifier nodes."""

    def walk(e: Expr) -> None:
        if isinstance(e, Identifier):
            e.type = symbol_table.get(e.name)
        elif isinstance(e, (StringLiteral, NumberLiteral)):
            return
        elif isinstance(e, FunctionCall):
            for a in e.args:
                walk(a)
        elif isinstance(e, BinaryOp):
            walk(e.left)
            walk(e.right)
        elif isinstance(e, LogicalOp):
            walk(e.left)
            walk(e.right)

    walk(expr)


def build_symbol_table(inputs: Dict[str, str]) -> Dict[str, Type]:
    return {name: type_from_input_keyword(tip) for name, tip in inputs.items()}


def attach_all_identifier_types(ast: dict, symbol_table: Dict[str, Type]) -> None:
    for section in ("requires", "forbids", "effects"):
        for expr in ast.get(section, []):
            if isinstance(expr, Expr):
                attach_identifier_types(expr, symbol_table)


def expr_to_json(node: Optional[Expr]) -> Any:
    if node is None:
        return None
    if isinstance(node, Identifier):
        out: dict = {"type": "Identifier", "name": node.name}
        if node.type is not None:
            out["semantic_type"] = type_label(node.type)
        return out
    if isinstance(node, StringLiteral):
        return {"type": "StringLiteral", "value": node.value}
    if isinstance(node, NumberLiteral):
        v = node.value
        if isinstance(v, float) and v.is_integer():
            v = int(v)
        return {"type": "NumberLiteral", "value": v}
    if isinstance(node, FunctionCall):
        return {
            "type": "FunctionCall",
            "name": node.name,
            "arguments": [expr_to_json(a) for a in node.args],
        }
    if isinstance(node, BinaryOp):
        return {
            "type": "BinaryOp",
            "operator": node.op,
            "left": expr_to_json(node.left),
            "right": expr_to_json(node.right),
        }
    if isinstance(node, LogicalOp):
        return {
            "type": "LogicalOp",
            "operator": node.op,
            "left": expr_to_json(node.left),
            "right": expr_to_json(node.right),
        }
    raise TypeError(f"Unknown expr type: {type(node)}")


# --- Tokenizer -------------------------------------------------------------------------------

class KuralParser:
    def __init__(self):
        self.keywords = ["hedef", "girdi", "gerektirir", "yasaklar", "etkiler", "sonuç"]
        self.token_patterns = [
            ("KEYWORD", r"\b(?:" + "|".join(re.escape(k) for k in self.keywords) + r")\b"),
            ("MEVCUT", r"\bmevcut\b"),
            ("LOGICAL", r"\b(?:ve|veya)\b"),
            ("NUMBER", r"\d+(?:\.\d+)?"),
            ("STRING", r'"[^"]*"'),
            ("OPERATOR", r"==|!=|>=|<=|>|<"),
            ("COLON", r":"),
            ("COMMA", r","),
            ("LPAREN", r"\("),
            ("RPAREN", r"\)"),
            ("IDENTIFIER", r"[a-zA-Z_][a-zA-Z0-9_]*"),
            ("NL", r"\n"),
            ("SKIP", r"[ \t]+"),
            ("MARKDOWN", r"```kural|```"),
            ("MISMATCH", r"."),
        ]
        self.token_regex = "|".join("(?P<%s>%s)" % pair for pair in self.token_patterns)

    def tokenize(self, code: str) -> List[Tuple[str, str, int]]:
        tokens: List[Tuple[str, str, int]] = []
        line_num = 1
        for mo in re.finditer(self.token_regex, code):
            kind = mo.lastgroup
            assert kind is not None
            value = mo.group()
            if kind == "SKIP" or kind == "MARKDOWN":
                continue
            elif kind == "NL":
                tokens.append((kind, value, line_num))
                line_num += 1
                continue
            elif kind == "MISMATCH":
                raise SyntaxError(f"Unexpected character: {value!r} (line {line_num})")
            tokens.append((kind, value, line_num))
        return tokens

    def parse(self, code: str) -> dict:
        tokens = self.tokenize(code)
        ast: dict = {kw: [] for kw in self.keywords}
        ast["hedef"] = None
        ast["sonuç"] = None
        i = 0
        current_section: Optional[str] = None

        while i < len(tokens):
            kind, value, line = tokens[i]

            if kind == "KEYWORD":
                current_section = value
                i += 1
                if i < len(tokens) and tokens[i][0] == "COLON":
                    i += 1
                else:
                    raise SyntaxError(
                        f"Expected ':' after keyword '{current_section}' (line {line})"
                    )
                continue

            if current_section == "hedef":
                if kind == "IDENTIFIER":
                    ast["hedef"] = value
                i += 1
                continue

            if current_section == "girdi":
                if kind == "NL":
                    i += 1
                    continue
                if kind == "IDENTIFIER":
                    name = value
                    i += 1
                    if i < len(tokens) and tokens[i][0] == "COLON":
                        i += 1
                        if i < len(tokens) and tokens[i][0] == "IDENTIFIER":
                            type_name = tokens[i][1]
                            ast["girdi"].append({"ad": name, "tip": type_name})
                            i += 1
                        else:
                            raise SyntaxError(f"Expected input type name (line {line})")
                    else:
                        raise SyntaxError(f"Expected ':' in input declaration (line {line})")
                else:
                    i += 1
                continue

            if current_section in ("gerektirir", "yasaklar"):
                statements, i = _split_section_statements(tokens, i)
                for stmt_tokens in statements:
                    if not stmt_tokens:
                        continue
                    p = _ExprParser(stmt_tokens)
                    ast[current_section].append(p.parse_expression())
                continue

            if current_section == "etkiler":
                statements, i = _split_section_statements(tokens, i)
                for stmt_tokens in statements:
                    if not stmt_tokens:
                        continue
                    p = _ExprParser(stmt_tokens)
                    ast["etkiler"].append(p.parse_effect_function_call())
                continue

            if current_section == "sonuç":
                if kind == "STRING":
                    ast["sonuç"] = value[1:-1]
                i += 1
                continue

            i += 1

        return ast


def _split_section_statements(
    tokens: List[Tuple[str, str, int]], start: int
) -> Tuple[List[List[Tuple[str, str, int]]], int]:
    statements: List[List[Tuple[str, str, int]]] = []
    current: List[Tuple[str, str, int]] = []
    i = start
    while i < len(tokens):
        k = tokens[i][0]
        if k == "KEYWORD":
            break
        if k == "NL":
            if current:
                statements.append(current)
                current = []
            i += 1
            continue
        current.append(tokens[i])
        i += 1
    if current:
        statements.append(current)
    return statements, i


class _ExprParser:
    def __init__(self, tokens: List[Tuple[str, str, int]]):
        self.tokens = tokens
        self.pos = 0

    def _peek(self) -> Optional[str]:
        if self.pos >= len(self.tokens):
            return None
        return self.tokens[self.pos][0]

    def _line(self) -> int:
        if self.pos >= len(self.tokens):
            return self.tokens[-1][2] if self.tokens else 0
        return self.tokens[self.pos][2]

    def _advance(self) -> Tuple[str, str, int]:
        if self.pos >= len(self.tokens):
            raise SyntaxError(f"Unexpected end of input (line {self._line()})")
        t = self.tokens[self.pos]
        self.pos += 1
        return t

    def parse_effect_function_call(self) -> FunctionCall:
        fc = self._parse_function_call_expr()
        if self.pos < len(self.tokens):
            kind, val, line = self.tokens[self.pos]
            raise SyntaxError(f"Unexpected trailing token: {val!r} (line {line})")
        if not isinstance(fc, FunctionCall):
            raise SyntaxError(f"Effect must be a function call (line {self._line()})")
        return fc

    def parse_expression(self) -> Expr:
        return self._parse_logical()

    def _parse_logical(self) -> Expr:
        left = self._parse_comparison()
        while self._peek() == "LOGICAL":
            _, op, _ = self._advance()
            right = self._parse_comparison()
            left = LogicalOp(left, op, right)
        return left

    def _parse_comparison(self) -> Expr:
        left = self._parse_factor()
        while self._peek() == "OPERATOR":
            _, op, _ = self._advance()
            right = self._parse_factor()
            left = BinaryOp(left, op, right)
        return left

    def _parse_factor(self) -> Expr:
        if self._peek() == "MEVCUT":
            self._advance()
            kind, name, line = self._advance()
            if kind != "IDENTIFIER":
                raise SyntaxError(f"Expected identifier after 'mevcut' (line {line})")
            return FunctionCall("mevcut", [Identifier(name)])

        if self._peek() == "LPAREN":
            self._advance()
            inner = self._parse_logical()
            kind, val, line = self._advance()
            if kind != "RPAREN":
                raise SyntaxError(f"Expected ')', found: {val!r} (line {line})")
            return inner

        if self._peek() == "STRING":
            _, raw, _ = self._advance()
            return StringLiteral(raw[1:-1])

        if self._peek() == "NUMBER":
            _, raw, _ = self._advance()
            if "." in raw:
                return NumberLiteral(float(raw))
            return NumberLiteral(int(raw))

        if self._peek() == "IDENTIFIER":
            _, name, line = self._advance()
            if self._peek() == "LPAREN":
                return self._parse_call_after_name(name)
            if self._peek() == "MEVCUT":
                self._advance()
                return FunctionCall("mevcut", [Identifier(name)])
            return Identifier(name)

        kind = self._peek()
        raise SyntaxError(f"Expected expression (line {self._line()}), found: {kind}")

    def _parse_call_after_name(self, name: str) -> Expr:
        self._advance()
        args: List[Expr] = []
        if self._peek() != "RPAREN":
            args.append(self._parse_argument())
            while self._peek() == "COMMA":
                self._advance()
                args.append(self._parse_argument())
        kind, val, line = self._advance()
        if kind != "RPAREN":
            raise SyntaxError(f"Expected ')' (line {line})")
        return FunctionCall(name, args)

    def _parse_argument(self) -> Expr:
        if self._peek() == "STRING":
            _, raw, _ = self._advance()
            return StringLiteral(raw[1:-1])
        if self._peek() == "NUMBER":
            _, raw, _ = self._advance()
            if "." in raw:
                return NumberLiteral(float(raw))
            return NumberLiteral(int(raw))
        if self._peek() == "IDENTIFIER":
            _, name, _ = self._advance()
            if self._peek() == "LPAREN":
                return self._parse_call_after_name(name)
            return Identifier(name)
        raise SyntaxError(f"Expected argument (line {self._line()})")

    def _parse_function_call_expr(self) -> Expr:
        if self._peek() != "IDENTIFIER":
            return self._parse_factor()
        _, name, _ = self._advance()
        if self._peek() == "LPAREN":
            return self._parse_call_after_name(name)
        raise SyntaxError(f"Expected function call: {name}(")


# --- Semantic verifier (V0.2) -----------------------------------------------------------------

def _iter_identifiers(expr: Expr) -> List[Identifier]:
    out: List[Identifier] = []

    def walk(e: Expr) -> None:
        if isinstance(e, Identifier):
            out.append(e)
        elif isinstance(e, (StringLiteral, NumberLiteral)):
            return
        elif isinstance(e, FunctionCall):
            for a in e.args:
                walk(a)
        elif isinstance(e, BinaryOp):
            walk(e.left)
            walk(e.right)
        elif isinstance(e, LogicalOp):
            walk(e.left)
            walk(e.right)

    walk(expr)
    return out


def _require_boolean_expr(
    expr: Expr,
    section: str,
    errors: List[str],
    symbol_table: Dict[str, Type],
    function_registry: Dict[str, FunctionSignature],
) -> None:
    t = infer_type(expr, symbol_table, function_registry)
    if t is None:
        return
    if t != BooleanType():
        lt = type_label(t)
        errors.append(
            f"Error: expression in '{section}' must be boolean; inferred type: {lt}."
        )


class SemanticVerifier:
    """Type inference and symbol/function checks on canonical (English) AST."""

    def __init__(
        self,
        function_registry: Optional[Dict[str, FunctionSignature]] = None,
        *,
        enforce_effect_void: bool = True,
    ):
        self.function_registry: Dict[str, FunctionSignature] = (
            function_registry if function_registry is not None else default_function_registry()
        )
        self.enforce_effect_void = enforce_effect_void

    def verify(self, ast: dict) -> List[str]:
        errors: List[str] = []
        if not ast.get("goal"):
            errors.append("Error: missing 'goal'.")

        inputs_map = ast.get("inputs") or {}
        if not inputs_map:
            errors.append("Error: 'inputs' is empty or missing.")

        try:
            symbol_table = build_symbol_table(inputs_map)
        except ValueError as e:
            errors.append(f"Error: {e}")
            symbol_table = {}

        attach_all_identifier_types(ast, symbol_table)

        input_names = set(symbol_table.keys())
        reg = self.function_registry

        def verify_expr(expr: Expr, section: str) -> None:
            for ident in _iter_identifiers(expr):
                if ident.name not in input_names:
                    errors.append(
                        f"Warning: identifier '{ident.name}' is not declared in inputs "
                        f"(section: {section})."
                    )

            _semantic_check(expr, section, errors, symbol_table, reg)

        for expr in ast.get("requires", []):
            if isinstance(expr, Expr):
                verify_expr(expr, "requires")
                _require_boolean_expr(expr, "requires", errors, symbol_table, reg)

        for expr in ast.get("forbids", []):
            if isinstance(expr, Expr):
                verify_expr(expr, "forbids")
                _require_boolean_expr(expr, "forbids", errors, symbol_table, reg)

        for expr in ast.get("effects", []):
            if isinstance(expr, FunctionCall):
                verify_expr(expr, "effects")
                sig = reg.get(expr.name)
                if (
                    self.enforce_effect_void
                    and sig is not None
                    and sig.return_type != VoidType()
                ):
                    errors.append(
                        f"Error: effect '{expr.name}' must be void; "
                        f"registry return type: {type_label(sig.return_type)}."
                    )

        return errors


# --- Core IR (canonical semantic layer) -------------------------------------------------------

class ConstraintKind(Enum):
    REQUIRE = "require"
    FORBID = "forbid"


class GuaranteeType(Enum):
    EXISTS = "exists"
    EQUALS = "equals"


class Constraint:
    def __init__(self, kind: ConstraintKind, expr: Expr):
        self.kind = kind
        self.expr = expr


class Guarantee:
    """Semantic guarantee from a precondition (before) or a transition (after)."""

    __slots__ = ("identifier", "source", "gtype", "equals_value")

    def __init__(
        self,
        identifier: str,
        source: Any,
        gtype: GuaranteeType = GuaranteeType.EXISTS,
        equals_value: Any = None,
    ):
        self.identifier = identifier
        self.source = source
        self.gtype = gtype
        self.equals_value = equals_value

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Guarantee):
            return NotImplemented
        return (
            self.identifier == other.identifier
            and self.source is other.source
            and self.gtype == other.gtype
            and self.equals_value == other.equals_value
        )

    def __hash__(self) -> int:
        return hash((self.identifier, id(self.source), self.gtype, self.equals_value))


class Effect:
    """Legacy flat IR; prefer TransitionEffect for stateful core."""

    def __init__(self, call: FunctionCall):
        self.call = call


class StateRef:
    def __init__(self, name: str):
        self.name = name


STATE_REF_BEFORE = StateRef("before")
STATE_REF_AFTER = StateRef("after")


class StatePredicate:
    """Boolean condition at a state; role: precondition | forbidden."""

    def __init__(self, expr: Expr, state: StateRef, role: str):
        self.expr = expr
        self.state = state
        self.role = role


class TransitionEffect:
    def __init__(self, call: FunctionCall, from_state: StateRef, to_state: StateRef):
        self.call = call
        self.from_state = from_state
        self.to_state = to_state


class Postcondition:
    """Placeholder for future postcondition syntax."""

    def __init__(self, expr: Expr, state: StateRef):
        self.expr = expr
        self.state = state


class CoreGoal:
    """DEPRECATED transitional semantic model. IRGoal is the operational core."""

    def __init__(
        self,
        name: Optional[str],
        inputs: Dict[str, Type],
        preconditions: List[StatePredicate],
        forbidden: List[StatePredicate],
        transitions: List[TransitionEffect],
        result: Optional[str],
        postconditions: Optional[List[Postcondition]] = None,
    ):
        self.name = name
        self.inputs = inputs
        self.preconditions = preconditions
        self.forbidden = forbidden
        self.transitions = transitions
        self.result = result
        self.postconditions = postconditions or []

    @property
    def legacy_constraints(self) -> List[Constraint]:
        return [Constraint(ConstraintKind.REQUIRE, p.expr) for p in self.preconditions] + [
            Constraint(ConstraintKind.FORBID, f.expr) for f in self.forbidden
        ]

    @property
    def legacy_effects(self) -> List[Effect]:
        return [Effect(t.call) for t in self.transitions]


class ConstraintGraph:
    def __init__(self) -> None:
        self.nodes: List[StatePredicate] = []
        self.edges: List[Tuple[str, StatePredicate]] = []


def extract_identifiers(expr: Expr) -> Set[str]:
    return {i.name for i in _iter_identifiers(expr)}


def extract_guarantees_from_predicate(predicate: StatePredicate) -> Set[Guarantee]:
    """
    Safe under-approximation of guarantees. Forbidden yields none.
    Preconditions: exists(x), x==literal, x~literal comparisons.
    """
    if predicate.role != "precondition":
        return set()
    return _guarantees_from_expr(predicate.expr, predicate)


def _guarantees_from_expr(expr: Expr, source: StatePredicate) -> Set[Guarantee]:
    g: Set[Guarantee] = set()
    if isinstance(expr, FunctionCall):
        if expr.name == "exists" and len(expr.args) == 1 and isinstance(
            expr.args[0], Identifier
        ):
            g.add(Guarantee(expr.args[0].name, source, GuaranteeType.EXISTS))
        return g
    if isinstance(expr, BinaryOp):
        lit_l = _literal_atom(expr.left)
        lit_r = _literal_atom(expr.right)
        if isinstance(expr.left, Identifier) and lit_r is not None:
            gt = (
                GuaranteeType.EQUALS
                if expr.op == "=="
                else GuaranteeType.EXISTS
            )
            g.add(Guarantee(expr.left.name, source, gt))
        elif isinstance(expr.right, Identifier) and lit_l is not None:
            gt = (
                GuaranteeType.EQUALS
                if expr.op == "=="
                else GuaranteeType.EXISTS
            )
            g.add(Guarantee(expr.right.name, source, gt))
        g |= _guarantees_from_expr(expr.left, source)
        g |= _guarantees_from_expr(expr.right, source)
        return g
    if isinstance(expr, LogicalOp):
        g |= _guarantees_from_expr(expr.left, source)
        g |= _guarantees_from_expr(expr.right, source)
        return g
    return g


def build_guarantee_table(
    core_goal: CoreGoal,
) -> Dict[str, Dict[str, List[Guarantee]]]:
    """Map state_name → identifier → [Guarantee]; only 'before' preconditions for now."""
    table: Dict[str, Dict[str, List[Guarantee]]] = {}
    for p in core_goal.preconditions:
        if p.state.name != STATE_REF_BEFORE.name:
            continue
        st_key = p.state.name
        for gu in extract_guarantees_from_predicate(p):
            table.setdefault(st_key, {}).setdefault(gu.identifier, []).append(gu)
    return table


def build_after_guarantee_table(
    core_goal: CoreGoal,
    function_registry: Dict[str, FunctionSignature],
    before_guarantee_table: Dict[str, Dict[str, List[Guarantee]]],
) -> Dict[str, List[Guarantee]]:
    """
    After-state guarantees from transition metadata only (no automatic before→after copy).
    before_guarantee_table is reserved for future cross-state rules.
    """
    _ = before_guarantee_table
    after: Dict[str, List[Guarantee]] = {}
    for te in core_goal.transitions:
        sig = function_registry.get(te.call.name)
        if sig is None or not sig.guarantees_after:
            continue
        for spec in sig.guarantees_after:
            idx = spec.identifier_source_index
            if idx is None or idx < 0 or idx >= len(te.call.args):
                continue
            arg = te.call.args[idx]
            if not isinstance(arg, Identifier):
                continue
            gt_raw = (spec.guarantee_type or "exists").lower()
            if gt_raw == "equals":
                gtype = GuaranteeType.EQUALS
                eq_val = spec.equals_literal
            else:
                gtype = GuaranteeType.EXISTS
                eq_val = None
            gu = Guarantee(arg.name, te, gtype, equals_value=eq_val)
            after.setdefault(arg.name, []).append(gu)
    return after


def build_full_guarantee_table(
    core_goal: CoreGoal,
    function_registry: Optional[Dict[str, FunctionSignature]] = None,
) -> Dict[str, Dict[str, List[Guarantee]]]:
    """Unified guarantee_table[state_name][identifier] → guarantees (before + after)."""
    reg = function_registry if function_registry is not None else default_function_registry()
    before_part = build_guarantee_table(core_goal)
    after_slice = build_after_guarantee_table(core_goal, reg, before_part)
    return {
        STATE_REF_BEFORE.name: before_part.get(STATE_REF_BEFORE.name, {}),
        STATE_REF_AFTER.name: after_slice,
    }


def transition_resolves_after_guarantee(
    te: TransitionEffect, sig: FunctionSignature
) -> bool:
    """True if at least one guarantees_after spec resolves to an Identifier on this call."""
    for spec in sig.guarantees_after:
        idx = spec.identifier_source_index
        if idx is None or idx < 0 or idx >= len(te.call.args):
            continue
        if isinstance(te.call.args[idx], Identifier):
            return True
    return False


def _weak_precondition_predicate_warnings(
    expr: Expr, predicate: StatePredicate, warnings: List[str]
) -> None:
    """Warn that precondition predicate f(x) does not guarantee its arguments."""

    def walk(e: Expr) -> None:
        if isinstance(e, FunctionCall):
            if e.name != "exists":
                for arg in e.args:
                    if isinstance(arg, Identifier):
                        warnings.append(
                            f"Warning: precondition predicate '{e.name}(...)' does not "
                            f"guarantee '{arg.name}' (weak precondition)."
                        )
                    else:
                        walk(arg)
            return
        if isinstance(e, BinaryOp):
            walk(e.left)
            walk(e.right)
        elif isinstance(e, LogicalOp):
            walk(e.left)
            walk(e.right)

    walk(expr)


def extract_transition_reads(
    effect: TransitionEffect,
    registry: Optional[Dict[str, FunctionSignature]] = None,
) -> Set[str]:
    reg = registry or {}
    sig = reg.get(effect.call.name)
    if sig is not None and sig.reads is not None:
        return set(sig.reads)
    return extract_identifiers(effect.call)


def extract_transition_writes(
    effect: TransitionEffect,
    registry: Optional[Dict[str, FunctionSignature]] = None,
) -> Set[str]:
    reg = registry or {}
    sig = reg.get(effect.call.name)
    if sig is not None and sig.writes is not None:
        return set(sig.writes)
    return set()


def check_transition_read_guarantees(
    core_goal: CoreGoal,
    guarantee_table: Dict[str, Dict[str, List[Guarantee]]],
    registry: Optional[Dict[str, FunctionSignature]] = None,
) -> List[str]:
    errors: List[str] = []
    before_gt = guarantee_table.get(STATE_REF_BEFORE.name, {})
    reg = registry or {}
    for te in core_goal.transitions:
        reads = extract_transition_reads(te, reg)
        for id_ in reads:
            if id_ not in before_gt:
                errors.append(
                    f"Error: '{id_}' is read by transition '{te.call.name}' but has no "
                    f"guarantee in 'before' preconditions."
                )
    return errors


def guarantee_table_to_json(
    core_goal: CoreGoal, table: Dict[str, Dict[str, List[Guarantee]]]
) -> dict:
    pred_index = {id(p): i for i, p in enumerate(core_goal.preconditions)}
    trans_index = {id(t): i for i, t in enumerate(core_goal.transitions)}
    out: dict = {}
    for state_name in sorted(table.keys()):
        per_id = table[state_name]
        out[state_name] = {}
        for id_name in sorted(per_id.keys()):
            entries: List[dict] = []
            for gu in per_id[id_name]:
                src = gu.source
                if isinstance(src, StatePredicate):
                    ent: dict = {
                        "type": gu.gtype.value,
                        "from_precondition": pred_index[id(src)],
                    }
                elif isinstance(src, TransitionEffect):
                    ent = {
                        "type": gu.gtype.value,
                        "from_transition": trans_index[id(src)],
                    }
                else:
                    ent = {"type": gu.gtype.value, "source": "unknown"}
                if gu.gtype == GuaranteeType.EQUALS and gu.equals_value is not None:
                    ent["equals"] = gu.equals_value
                entries.append(ent)
            out[state_name][id_name] = entries
    return out


def ast_to_core(ast: dict, symbol_table: Dict[str, Type]) -> CoreGoal:
    preconditions: List[StatePredicate] = []
    for expr in ast.get("requires", []):
        if isinstance(expr, Expr):
            preconditions.append(
                StatePredicate(expr, STATE_REF_BEFORE, "precondition")
            )
    forbidden: List[StatePredicate] = []
    for expr in ast.get("forbids", []):
        if isinstance(expr, Expr):
            forbidden.append(StatePredicate(expr, STATE_REF_BEFORE, "forbidden"))
    transitions: List[TransitionEffect] = []
    for call in ast.get("effects", []):
        if isinstance(call, FunctionCall):
            transitions.append(
                TransitionEffect(call, STATE_REF_BEFORE, STATE_REF_AFTER)
            )
    return CoreGoal(
        name=ast.get("goal"),
        inputs=dict(symbol_table),
        preconditions=preconditions,
        forbidden=forbidden,
        transitions=transitions,
        result=ast.get("result"),
    )


def build_constraint_graph(core_goal: CoreGoal) -> ConstraintGraph:
    graph = ConstraintGraph()
    for p in core_goal.preconditions:
        graph.nodes.append(p)
        for id_ in extract_identifiers(p.expr):
            graph.edges.append((id_, p))
    for f in core_goal.forbidden:
        graph.nodes.append(f)
        for id_ in extract_identifiers(f.expr):
            graph.edges.append((id_, f))
    return graph


def expr_structural_key(expr: Expr) -> str:
    return json.dumps(expr_to_json(expr), sort_keys=True, ensure_ascii=False)


def _literal_atom(expr: Expr) -> Any:
    """Python value for numeric/string literal, else None."""
    if isinstance(expr, NumberLiteral):
        v = expr.value
        if isinstance(v, float) and v.is_integer():
            return int(v)
        return v
    if isinstance(expr, StringLiteral):
        return expr.value
    return None


def expr_boolean_constant(expr: Expr) -> Optional[bool]:
    """Constant-fold boolean from literal comparisons and and/or; else None."""
    if isinstance(expr, LogicalOp):
        a = expr_boolean_constant(expr.left)
        b = expr_boolean_constant(expr.right)
        if a is None or b is None:
            return None
        if expr.op in ("ve", "and"):
            return a and b
        if expr.op in ("veya", "or"):
            return a or b
        return None

    if isinstance(expr, BinaryOp):
        L = _literal_atom(expr.left)
        R = _literal_atom(expr.right)
        if L is None or R is None:
            return None
        if type(L) is not type(R):
            return None
        op = expr.op
        if op == "==":
            return L == R
        if op == "!=":
            return L != R
        if op == ">" and isinstance(L, (int, float)):
            return L > R
        if op == "<" and isinstance(L, (int, float)):
            return L < R
        if op == ">=" and isinstance(L, (int, float)):
            return L >= R
        if op == "<=" and isinstance(L, (int, float)):
            return L <= R
        return None

    return None


def _ir_type_name_for_input(t: Type) -> str:
    lab = type_label(t)
    if lab == "bound_input":
        return "unknown"
    return lab


def _ir_semantic_type_for_identifier(expr: Identifier) -> str:
    lab = type_label(expr.type)
    if lab == "bound_input":
        return "unknown"
    return lab


def lower_expr_to_ir(expr: Expr) -> IRExpr:
    """Lower semantic/core expression AST to canonical IR expressions (V0.9 boundary)."""
    if isinstance(expr, Identifier):
        return IRIdentifier(expr.name, semantic_type=_ir_semantic_type_for_identifier(expr))
    if isinstance(expr, StringLiteral):
        return IRStringLiteral(expr.value)
    if isinstance(expr, NumberLiteral):
        return IRNumberLiteral(expr.value)
    if isinstance(expr, FunctionCall):
        return IRCall(
            expr.name,
            [lower_expr_to_ir(a) for a in expr.args],
        )
    if isinstance(expr, BinaryOp):
        return IRBinary(
            lower_expr_to_ir(expr.left),
            expr.op,
            lower_expr_to_ir(expr.right),
        )
    if isinstance(expr, LogicalOp):
        return IRLogical(
            lower_expr_to_ir(expr.left),
            expr.op,
            lower_expr_to_ir(expr.right),
        )
    raise TypeError(f"Cannot lower expression type to IR: {type(expr)!r}")


def core_to_ir(core_goal: CoreGoal) -> IRGoal:
    """Lower CoreGoal (semantic working model) to canonical IRGoal (transfer boundary)."""
    inputs = [
        IRInput(n, _ir_type_name_for_input(t))
        for n, t in sorted(core_goal.inputs.items())
    ]
    preconditions = [
        IRCondition(f"c_req_{i + 1:04d}", "require", lower_expr_to_ir(p.expr))
        for i, p in enumerate(core_goal.preconditions)
    ]
    forbids = [
        IRCondition(f"c_forbid_{i + 1:04d}", "forbid", lower_expr_to_ir(f.expr))
        for i, f in enumerate(core_goal.forbidden)
    ]
    postconditions = [
        IRCondition(f"c_post_{i + 1:04d}", "postcondition", lower_expr_to_ir(pc.expr))
        for i, pc in enumerate(core_goal.postconditions)
    ]
    transitions = [
        IRTransition(
            f"t_{i + 1:04d}",
            te.call.name,
            [lower_expr_to_ir(a) for a in te.call.args],
            te.from_state.name,
            te.to_state.name,
        )
        for i, te in enumerate(core_goal.transitions)
    ]
    goal_name = (core_goal.name or "").strip()
    return IRGoal(
        goal=goal_name,
        inputs=inputs,
        preconditions=preconditions,
        forbids=forbids,
        transitions=transitions,
        postconditions=postconditions,
        result=core_goal.result,
        metadata=None,
    )


def core_goal_to_json(core: CoreGoal) -> dict:
    return {
        "goal": core.name,
        "inputs": {n: type_label(t) for n, t in core.inputs.items()},
        "preconditions": [
            {"state": p.state.name, "role": p.role, "expr": expr_to_json(p.expr)}
            for p in core.preconditions
        ],
        "forbidden": [
            {"state": f.state.name, "role": f.role, "expr": expr_to_json(f.expr)}
            for f in core.forbidden
        ],
        "transitions": [
            {
                "call": expr_to_json(t.call),
                "from_state": t.from_state.name,
                "to_state": t.to_state.name,
            }
            for t in core.transitions
        ],
        "postconditions": [
            {"state": pc.state.name, "expr": expr_to_json(pc.expr)}
            for pc in core.postconditions
        ],
        "result": core.result,
        "legacy_debug": {
            "constraints": [
                {"kind": c.kind.value, "expr": expr_to_json(c.expr)}
                for c in core.legacy_constraints
            ],
            "effects": [expr_to_json(e.call) for e in core.legacy_effects],
        },
    }


def constraint_graph_to_json(graph: ConstraintGraph) -> dict:
    node_index = {id(n): i for i, n in enumerate(graph.nodes)}
    return {
        "nodes": [
            {
                "index": i,
                "state": n.state.name,
                "role": n.role,
                "expr": expr_to_json(n.expr),
            }
            for i, n in enumerate(graph.nodes)
        ],
        "edges": [
            {"from": id_name, "to_node": node_index[id(to_n)]}
            for id_name, to_n in graph.edges
        ],
    }


class AdvancedVerifier:
    """State-aware core: before guarantees and transition reads."""

    def __init__(
        self,
        function_registry: Optional[Dict[str, FunctionSignature]] = None,
    ):
        self.function_registry: Dict[str, FunctionSignature] = (
            function_registry if function_registry is not None else default_function_registry()
        )

    def verify(
        self,
        core: CoreGoal,
        graph: ConstraintGraph,
        guarantee_table: Optional[Dict[str, Dict[str, List[Guarantee]]]] = None,
    ) -> Tuple[List[str], List[str]]:
        errors: List[str] = []
        warnings: List[str] = []

        gt = guarantee_table if guarantee_table is not None else build_guarantee_table(core)
        gt_before = gt.get(STATE_REF_BEFORE.name, {})

        pre_keys = [expr_structural_key(p.expr) for p in core.preconditions]
        forbid_keys = [expr_structural_key(f.expr) for f in core.forbidden]
        if set(pre_keys) & set(forbid_keys):
            errors.append(
                "Error: the same boolean expression appears in both preconditions "
                "(before) and forbidden (before)."
            )

        for p in core.preconditions:
            _weak_precondition_predicate_warnings(p.expr, p, warnings)

        all_predicate_ids: Set[str] = set()
        for p in core.preconditions:
            all_predicate_ids |= extract_identifiers(p.expr)
        for f in core.forbidden:
            all_predicate_ids |= extract_identifiers(f.expr)
        transition_read_ids: Set[str] = set()
        for te in core.transitions:
            transition_read_ids |= extract_transition_reads(te, self.function_registry)

        forbid_ids: Set[str] = set()
        for f in core.forbidden:
            forbid_ids |= extract_identifiers(f.expr)

        errors.extend(
            check_transition_read_guarantees(core, gt, self.function_registry)
        )

        for id_ in forbid_ids:
            if id_ not in gt_before:
                errors.append(
                    f"Error: identifier '{id_}' is used in forbidden (before) without a "
                    f"guarantee from preconditions (before)."
                )

        for inp in core.inputs:
            if inp not in all_predicate_ids and inp not in transition_read_ids:
                warnings.append(
                    f"Warning: input '{inp}' is not used in preconditions, forbidden, "
                    f"or transition reads."
                )

        for i, p in enumerate(core.preconditions):
            const = expr_boolean_constant(p.expr)
            if const is False:
                errors.append(
                    f"Error: precondition[{i}] (before) is always false; outcome is unreachable."
                )

        for i, f in enumerate(core.forbidden):
            const = expr_boolean_constant(f.expr)
            if const is True:
                errors.append(
                    f"Error: forbidden[{i}] (before) is always true; rule always rejects."
                )

        if core.transitions:
            res = (core.result or "").strip()
            if not res:
                warnings.append(
                    "Warning: transitions are defined but result text is empty or missing."
                )

        return errors, warnings


class PostStateVerifier:
    """After-state semantics: transition guarantees, contradictions, postconditions."""

    def __init__(
        self,
        function_registry: Optional[Dict[str, FunctionSignature]] = None,
    ):
        self.function_registry: Dict[str, FunctionSignature] = (
            function_registry if function_registry is not None else default_function_registry()
        )

    def verify(
        self,
        core: CoreGoal,
        guarantee_table: Dict[str, Dict[str, List[Guarantee]]],
    ) -> Tuple[List[str], List[str]]:
        errors: List[str] = []
        warnings: List[str] = []
        after = guarantee_table.get(STATE_REF_AFTER.name, {})
        reg = self.function_registry

        has_any_after = any(after.values())
        if core.transitions and (core.result or "").strip() and not has_any_after:
            warnings.append(
                "Warning: transitions and success result exist but no after-state guarantees "
                "are modeled (add guarantees_after on effect signatures)."
            )

        for te in core.transitions:
            sig = reg.get(te.call.name)
            if sig is None:
                continue
            if sig.writes and not transition_resolves_after_guarantee(te, sig):
                warnings.append(
                    f"Warning: transition '{te.call.name}' declares writes but resolves no "
                    f"after guarantees from guarantees_after metadata."
                )

        for id_name, glist in after.items():
            eq_vals = [
                g.equals_value
                for g in glist
                if g.gtype == GuaranteeType.EQUALS and g.equals_value is not None
            ]
            if len(eq_vals) <= 1:
                continue
            try:
                distinct = len(set(eq_vals))
            except TypeError:
                distinct = len({json.dumps(v, sort_keys=True, default=str) for v in eq_vals})
            if distinct > 1:
                errors.append(
                    f"Error: after-state contradictory EQUALS guarantees for identifier "
                    f"'{id_name}' (distinct literal values)."
                )

        for i, pc in enumerate(core.postconditions):
            if pc.state.name != STATE_REF_AFTER.name:
                continue
            for id_ in extract_identifiers(pc.expr):
                if id_ not in after:
                    warnings.append(
                        f"Warning: postcondition[{i}] references '{id_}' with no after-state "
                        f"guarantee (check guarantees_after or postcondition shape)."
                    )

        return errors, warnings


# --- Execution semantics (V0.7) — planner / evaluator ---------------------------------------


class ExecutionContext:
    def __init__(
        self,
        inputs: Dict[str, Any],
        world_state: Optional[Dict[str, Any]] = None,
    ):
        self.inputs = inputs
        self.world_state = world_state if world_state is not None else {}


class ExecutionStep:
    def __init__(self, kind: str, detail: Any, status: str = "pending"):
        self.kind = kind
        self.detail = detail
        self.status = status


class ExecutionPlan:
    def __init__(self, steps: List[ExecutionStep]):
        self.steps = steps


class ExecutionResult:
    def __init__(
        self,
        success: bool,
        result_text: Optional[str] = None,
        executed_effects: Optional[List[str]] = None,
        failed_step: Optional[ExecutionStep] = None,
        errors: Optional[List[str]] = None,
        after_state_summary: Optional[dict] = None,
    ):
        self.success = success
        self.result_text = result_text
        self.executed_effects = executed_effects or []
        self.failed_step = failed_step
        self.errors = errors or []
        self.after_state_summary = after_state_summary or {}


def build_execution_plan(core_goal: CoreGoal) -> ExecutionPlan:
    steps: List[ExecutionStep] = []
    for i in range(len(core_goal.preconditions)):
        steps.append(
            ExecutionStep("check_precondition", {"index": i}, "pending")
        )
    for i in range(len(core_goal.forbidden)):
        steps.append(ExecutionStep("check_forbidden", {"index": i}, "pending"))
    for i in range(len(core_goal.transitions)):
        steps.append(
            ExecutionStep(
                "run_effect",
                {"index": i, "name": core_goal.transitions[i].call.name},
                "pending",
            )
        )
    steps.append(ExecutionStep("finish", {"result_text": core_goal.result}, "pending"))
    return ExecutionPlan(steps)


def _resolve_identifier(name: str, context: ExecutionContext) -> Any:
    if name in context.inputs:
        return context.inputs[name]
    return context.world_state.get(name)


def evaluate_expr(
    expr: Expr,
    context: ExecutionContext,
    function_registry: Optional[Dict[str, FunctionSignature]],
    runtime_impls: Dict[str, Any],
) -> Any:
    """Dynamic evaluation for execution (separate from static verification)."""
    if isinstance(expr, Identifier):
        return _resolve_identifier(expr.name, context)

    if isinstance(expr, StringLiteral):
        return expr.value

    if isinstance(expr, NumberLiteral):
        v = expr.value
        if isinstance(v, float) and v.is_integer():
            return int(v)
        return v

    if isinstance(expr, FunctionCall):
        fn = runtime_impls.get(expr.name)
        if fn is None:
            raise RuntimeError(f"No runtime implementation for '{expr.name}'")
        args = [
            evaluate_expr(a, context, function_registry, runtime_impls)
            for a in expr.args
        ]
        return _invoke_runtime(fn, args, context)

    if isinstance(expr, BinaryOp):
        L = evaluate_expr(expr.left, context, function_registry, runtime_impls)
        R = evaluate_expr(expr.right, context, function_registry, runtime_impls)
        op = expr.op
        if op == "==":
            return L == R
        if op == "!=":
            return L != R
        if op == ">":
            return L > R
        if op == "<":
            return L < R
        if op == ">=":
            return L >= R
        if op == "<=":
            return L <= R
        raise RuntimeError(f"Unsupported binary operator: {op!r}")

    if isinstance(expr, LogicalOp):
        op = expr.op
        if op in ("and", "ve"):
            return bool(
                evaluate_expr(expr.left, context, function_registry, runtime_impls)
            ) and bool(
                evaluate_expr(expr.right, context, function_registry, runtime_impls)
            )
        if op in ("or", "veya"):
            return bool(
                evaluate_expr(expr.left, context, function_registry, runtime_impls)
            ) or bool(
                evaluate_expr(expr.right, context, function_registry, runtime_impls)
            )
        raise RuntimeError(f"Unsupported logical operator: {op!r}")

    raise TypeError(f"Cannot evaluate expression type: {type(expr)}")


def _invoke_runtime(fn: Any, args: List[Any], context: ExecutionContext) -> Any:
    try:
        sig = inspect.signature(fn)
        params = sig.parameters
        if "ctx" in params:
            return fn(*args, ctx=context)
        if "context" in params:
            return fn(*args, context=context)
    except (TypeError, ValueError):
        pass
    return fn(*args)


def default_runtime_impls() -> Dict[str, Any]:
    """
    Demo/stub runtime callables. Static FunctionSignature registry is separate.
    """

    def log_successful_login(username: str, ip_address: str, ctx: Any = None) -> None:
        if ctx and isinstance(ctx, ExecutionContext):
            ctx.world_state.setdefault("audit_log", []).append(
                {"event": "login", "username": username, "ip": ip_address}
            )

    def reset_failed_attempts(username: str, ctx: Any = None) -> None:
        if ctx and isinstance(ctx, ExecutionContext):
            ctx.world_state["failed_attempts_reset_for"] = username

    def start_session(username: str, ctx: Any = None) -> None:
        if ctx and isinstance(ctx, ExecutionContext):
            ctx.world_state["session_user"] = username

    return {
        "exists": lambda x: x is not None,
        "verify_username": lambda username: True,
        "verify_password": lambda username, password: True,
        "user_account_status": lambda username: "active",
        "ip_blacklisted": lambda ip_address: False,
        "log_successful_login": log_successful_login,
        "reset_failed_attempts": reset_failed_attempts,
        "start_session": start_session,
    }


def _execute_transition(
    te: TransitionEffect,
    context: ExecutionContext,
    runtime_impls: Dict[str, Any],
    function_registry: Optional[Dict[str, FunctionSignature]],
) -> None:
    call = te.call
    fn = runtime_impls.get(call.name)
    if fn is None:
        raise RuntimeError(f"No runtime implementation for effect '{call.name}'")
    args = [
        evaluate_expr(a, context, function_registry, runtime_impls) for a in call.args
    ]
    _invoke_runtime(fn, args, context)


def build_after_state_summary(
    core_goal: CoreGoal,
    executed_transition_indices: List[int],
    function_registry: Dict[str, FunctionSignature],
    after_guarantee_table: Dict[str, List[Guarantee]],
) -> dict:
    """
    Runtime-oriented summary for executed transitions only (reads/writes metadata +
    static after guarantees whose source transition ran). Does not merge full static
    after table into observed runtime state.
    """
    reads_all: Set[str] = set()
    writes_all: Set[str] = set()
    guarantee_types: Dict[str, Set[str]] = {}
    reg = function_registry
    for i in executed_transition_indices:
        if i < 0 or i >= len(core_goal.transitions):
            continue
        te = core_goal.transitions[i]
        reads_all |= extract_transition_reads(te, reg)
        writes_all |= extract_transition_writes(te, reg)
        for id_name, glist in after_guarantee_table.items():
            for gu in glist:
                if isinstance(gu.source, TransitionEffect) and gu.source is te:
                    guarantee_types.setdefault(id_name, set()).add(gu.gtype.value)
    return {
        "reads": sorted(reads_all),
        "writes": sorted(writes_all),
        "guarantees": {
            "after": {k: sorted(v) for k, v in guarantee_types.items()},
        },
    }


def execute_core_goal(
    core_goal: CoreGoal,
    context: ExecutionContext,
    function_registry: Optional[Dict[str, FunctionSignature]],
    runtime_impls: Dict[str, Any],
) -> Tuple[ExecutionResult, ExecutionPlan]:
    plan = build_execution_plan(core_goal)
    executed: List[str] = []
    executed_transition_indices: List[int] = []
    reg = function_registry if function_registry is not None else default_function_registry()

    for step in plan.steps:
        try:
            if step.kind == "check_precondition":
                idx = step.detail["index"]
                expr = core_goal.preconditions[idx].expr
                val = evaluate_expr(expr, context, reg, runtime_impls)
                if not bool(val):
                    step.status = "failed"
                    return (
                        ExecutionResult(
                            False,
                            failed_step=step,
                            errors=[
                                f"Precondition at index {idx} evaluated to false.",
                            ],
                            executed_effects=list(executed),
                            after_state_summary={},
                        ),
                        plan,
                    )
                step.status = "passed"

            elif step.kind == "check_forbidden":
                idx = step.detail["index"]
                expr = core_goal.forbidden[idx].expr
                val = evaluate_expr(expr, context, reg, runtime_impls)
                if bool(val):
                    step.status = "failed"
                    return (
                        ExecutionResult(
                            False,
                            failed_step=step,
                            errors=[
                                f"Forbidden at index {idx} evaluated to true.",
                            ],
                            executed_effects=list(executed),
                            after_state_summary={},
                        ),
                        plan,
                    )
                step.status = "passed"

            elif step.kind == "run_effect":
                idx = step.detail["index"]
                te = core_goal.transitions[idx]
                _execute_transition(te, context, runtime_impls, reg)
                step.status = "executed"
                executed.append(te.call.name)
                executed_transition_indices.append(idx)

            elif step.kind == "finish":
                step.status = "done"

        except Exception as ex:
            step.status = "failed"
            return (
                ExecutionResult(
                    False,
                    failed_step=step,
                    errors=[str(ex)],
                    executed_effects=list(executed),
                    after_state_summary={},
                ),
                plan,
            )

    before_t = build_guarantee_table(core_goal)
    after_t = build_after_guarantee_table(core_goal, reg, before_t)
    summary = build_after_state_summary(
        core_goal, executed_transition_indices, reg, after_t
    )
    return (
        ExecutionResult(
            True,
            result_text=core_goal.result,
            executed_effects=executed,
            after_state_summary=summary,
        ),
        plan,
    )


def execution_step_to_json(step: ExecutionStep) -> dict:
    detail = step.detail
    if not isinstance(detail, dict):
        detail = {"value": detail}
    return {"kind": step.kind, "status": step.status, "detail": detail}


def execution_plan_to_json(plan: ExecutionPlan) -> dict:
    return {"steps": [execution_step_to_json(s) for s in plan.steps]}


def execution_result_to_json(result: ExecutionResult) -> dict:
    out: dict = {
        "success": result.success,
        "result_text": result.result_text,
        "executed_effects": list(result.executed_effects),
        "errors": list(result.errors),
        "after_state_summary": dict(result.after_state_summary),
    }
    if result.failed_step is not None:
        out["failed_step"] = execution_step_to_json(result.failed_step)
    else:
        out["failed_step"] = None
    return out


def compare_core_vs_ir_execution(
    core_result: ExecutionResult, ir_result: IRExecutionResult
) -> List[str]:
    diffs: List[str] = []
    if core_result.success != ir_result.success:
        diffs.append(
            f"Execution mismatch: success differs (core={core_result.success}, ir={ir_result.success})."
        )
    if (core_result.result_text or "") != (ir_result.result_text or ""):
        diffs.append(
            "Execution mismatch: result_text differs "
            f"(core={core_result.result_text!r}, ir={ir_result.result_text!r})."
        )
    if len(core_result.executed_effects) != len(ir_result.executed_transitions):
        diffs.append(
            "Execution mismatch: executed count differs "
            f"(core={len(core_result.executed_effects)}, ir={len(ir_result.executed_transitions)})."
        )
    return diffs


def _semantic_check(
    expr: Expr,
    section: str,
    errors: List[str],
    symbol_table: Dict[str, Type],
    function_registry: Dict[str, FunctionSignature],
) -> None:
    if isinstance(expr, Identifier):
        return

    if isinstance(expr, (StringLiteral, NumberLiteral)):
        return

    if isinstance(expr, BinaryOp):
        lt = infer_type(expr.left, symbol_table, function_registry)
        rt = infer_type(expr.right, symbol_table, function_registry)
        if lt is None:
            errors.append(
                f"Error: cannot infer type of comparison left side (section: {section})."
            )
        if rt is None:
            errors.append(
                f"Error: cannot infer type of comparison right side (section: {section})."
            )
        if lt is not None and rt is not None and type(lt) != type(rt):
            errors.append(
                f"Error: comparison type mismatch: {type_label(lt)} vs {type_label(rt)} "
                f"(section: {section})."
            )
        _semantic_check(expr.left, section, errors, symbol_table, function_registry)
        _semantic_check(expr.right, section, errors, symbol_table, function_registry)
        return

    if isinstance(expr, LogicalOp):
        for side, label in ((expr.left, "left"), (expr.right, "right")):
            st = infer_type(side, symbol_table, function_registry)
            if st != BooleanType():
                errors.append(
                    f"Error: logical '{expr.op}' {label} operand must be boolean; "
                    f"type: {type_label(st)} (section: {section})."
                )
            _semantic_check(side, section, errors, symbol_table, function_registry)
        return

    if isinstance(expr, FunctionCall):
        sig = function_registry.get(expr.name)
        if sig is None:
            errors.append(
                f"Error: unknown function '{expr.name}' (section: {section})."
            )
            return

        if len(expr.args) != len(sig.arg_types):
            errors.append(
                f"Error: wrong argument count for '{expr.name}': "
                f"got {len(expr.args)}, expected {len(sig.arg_types)} (section: {section})."
            )
            return

        for i, (arg, expected) in enumerate(zip(expr.args, sig.arg_types)):
            ok, _ = _arg_type_matches(arg, expected, symbol_table, function_registry)
            if not ok:
                at = infer_type(arg, symbol_table, function_registry)
                errors.append(
                    f"Error: '{expr.name}' argument {i + 1} type mismatch: "
                    f"expected {type_label(expected)}, got {type_label(at)} "
                    f"(section: {section})."
                )
            _semantic_check(arg, section, errors, symbol_table, function_registry)
        return


# Legacy alias
KuralVerifier = SemanticVerifier


def main():
    argv = [
        a
        for a in sys.argv[1:]
        if a not in (
            "--no-demo-execute",
            "--ir-execution-only",
            "--engine-mode=python_only",
            "--engine-mode=rust_preferred",
            "--engine-mode=rust_only",
            "--platform-mode",
            "--legacy-core",
        )
    ]
    no_demo_execute = "--no-demo-execute" in sys.argv[1:]
    ir_execution_only = "--ir-execution-only" in sys.argv[1:]
    platform_mode = "--platform-mode" in sys.argv[1:]
    legacy_core = "--legacy-core" in sys.argv[1:]
    platform_full_cycle: Optional[Dict[str, Any]] = None
    engine_mode = "rust_preferred"
    for arg in sys.argv[1:]:
        if arg.startswith("--engine-mode="):
            engine_mode = arg.split("=", 1)[1].strip()
    if not argv:
        print(
            "Usage: python kural_parser.py <file_path> "
            "[--no-demo-execute] [--ir-execution-only] "
            "[--engine-mode=python_only|rust_preferred|rust_only] "
            "[--platform-mode] [--legacy-core]"
        )
        return

    file_path = argv[0]
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            code = f.read()

        parser = KuralParser()
        raw_ast = parser.parse(code)
        ast = normalize_ast(raw_ast)

        try:
            st_preview = build_symbol_table(ast["inputs"])
        except ValueError:
            st_preview = {}
        attach_all_identifier_types(ast, st_preview)

        serializable = {
            "goal": ast["goal"],
            "inputs": ast["inputs"],
            "requires": [expr_to_json(e) for e in ast["requires"]],
            "forbids": [expr_to_json(e) for e in ast["forbids"]],
            "effects": [expr_to_json(e) for e in ast["effects"]],
            "result": ast["result"],
        }

        print("--- Abstract syntax tree (canonical English) ---")
        print(json.dumps(serializable, indent=2, ensure_ascii=False))

        verifier = SemanticVerifier()
        semantic_errors = verifier.verify(ast)

        print("\n--- Semantic verification ---")
        if not semantic_errors:
            print("Semantic verification passed.")
        else:
            for err in semantic_errors:
                print(err)

        try:
            symbol_table_core = build_symbol_table(ast["inputs"])
        except ValueError:
            symbol_table_core = {}

        core = ast_to_core(ast, symbol_table_core)
        if legacy_core:
            graph = build_constraint_graph(core)
            reg_core = default_function_registry()
            guarantee_table = build_full_guarantee_table(core, reg_core)
            adv = AdvancedVerifier(reg_core)
            adv_errors, adv_warnings = adv.verify(core, graph, guarantee_table)
            post_v = PostStateVerifier(reg_core)
            post_errors, post_warnings = post_v.verify(core, guarantee_table)

            core_dump = {
                "core_goal": core_goal_to_json(core),
                "constraint_graph": constraint_graph_to_json(graph),
                "guarantee_table": guarantee_table_to_json(core, guarantee_table),
            }
            print("\n--- Core IR (state transition, canonical English) ---")
            print(json.dumps(core_dump, indent=2, ensure_ascii=False))

            print("\n--- Advanced verification (state-aware) ---")
            if not adv_errors and not adv_warnings:
                print("No advanced errors or warnings.")
            else:
                for err in adv_errors:
                    print(err)
                for w in adv_warnings:
                    print(w)

            print("\n--- Post-state verification (after guarantees) ---")
            if not post_errors and not post_warnings:
                print("No post-state errors or warnings.")
            else:
                for err in post_errors:
                    print(err)
                for w in post_warnings:
                    print(w)
        else:
            print(
                "\n--- Core IR (legacy CoreGoal) ---\n"
                "Skipped (IR-primary pipeline). Use --legacy-core for CoreGoal dump, "
                "constraint graph, and state-aware verification."
            )

        ir_goal = core_to_ir(core)
        ir_normalized = normalize_ir_goal(ir_goal)
        mutation_preview = ir_normalized
        mutation_diff = {"added": {}, "removed": {}, "changed": {}}
        mutation_preview_errors: List[str] = []
        if ir_normalized.inputs:
            first_input_name = ir_normalized.inputs[0].name
            preview_mutations = [
                IRMutation(
                    "add_precondition",
                    target=None,
                    payload={
                        "condition_id": "c_req_9000",
                        "expr": IRCall("exists", [IRIdentifier(first_input_name, semantic_type="unknown")]),
                    },
                )
            ]
            try:
                mutation_preview = apply_ir_mutation_batch(ir_normalized, preview_mutations)
                mutation_diff = compute_ir_diff(ir_normalized, mutation_preview)
            except Exception as ex:
                mutation_preview_errors.append(str(ex))

        print("\n--- IR Mutation Preview ---")
        if mutation_preview_errors:
            print("IR mutation preview failed.")
            for err in mutation_preview_errors:
                print(err)
        else:
            print(
                json.dumps(
                    ir_goal_to_json(mutation_preview),
                    indent=2,
                    ensure_ascii=False,
                    sort_keys=True,
                )
            )

        print("\n--- IR Diff ---")
        print(json.dumps(mutation_diff, indent=2, ensure_ascii=False, sort_keys=True))

        optimized_ir, optimization_report = optimize_ir_goal_with_report(ir_normalized)
        print("\n--- IR Optimization ---")
        print(
            json.dumps(
                ir_goal_to_json(optimized_ir),
                indent=2,
                ensure_ascii=False,
                sort_keys=True,
            )
        )
        print("\n--- Optimization Report ---")
        print(json.dumps(optimization_report, indent=2, ensure_ascii=False, sort_keys=True))

        ir_errors = validate_ir(ir_normalized)
        print("\n--- Canonical IR ---")
        print(
            json.dumps(
                ir_goal_to_json(ir_normalized),
                indent=2,
                ensure_ascii=False,
                sort_keys=True,
            )
        )
        print("\n--- IR validation ---")
        if ir_errors:
            for err in ir_errors:
                print(err)
        else:
            print("IR validation passed.")

        handoff_errors = validate_ir_handoff_compatibility(ir_normalized)
        print("\n--- Rust Handoff Compatibility ---")
        if handoff_errors:
            print("Rust handoff compatibility failed.")
            for err in handoff_errors:
                print(err)
        else:
            print("Rust handoff compatibility passed.")

        det_errors = validate_ir_semantic_determinism(ir_normalized)
        fp = compute_ir_fingerprint(ir_normalized)
        print("\n--- IR Determinism ---")
        print(
            "Canonical normalization: applied (commutative and/or and ==/!=; input list sorted)."
        )
        print(f"IR fingerprint (SHA-256, hex): {fp}")
        if det_errors:
            print("Semantic determinism: failed.")
            for err in det_errors:
                print(err)
        else:
            print("Semantic determinism: passed (no duplicate equivalent conditions/transitions).")

        ir_fn_reg = default_ir_function_registry()
        ir_sem_report = build_ir_semantic_report(ir_normalized, ir_fn_reg)
        print("\n--- IR Semantic Analysis ---")
        print("Symbol table:")
        print(
            json.dumps(
                ir_sem_report["symbol_table"],
                indent=2,
                ensure_ascii=False,
                sort_keys=True,
            )
        )
        print("Guarantee table (IR-native, before/after):")
        print(
            json.dumps(
                ir_sem_report["guarantee_table"],
                indent=2,
                ensure_ascii=False,
                sort_keys=True,
            )
        )
        for w in ir_sem_report["warnings"]:
            print(w)
        for e in ir_sem_report["errors"]:
            print(e)
        if ir_sem_report["semantic_ok"]:
            print("IR semantic analysis: passed.")
        else:
            print("IR semantic analysis: failed.")

        print("\n--- IR Semantic Report ---")
        print(
            json.dumps(
                ir_sem_report,
                indent=2,
                ensure_ascii=False,
                sort_keys=True,
            )
        )

        projection_plan = choose_projection_targets(
            ir_normalized,
            ir_sem_report,
            execution_summary=None,
            context=None,
        )
        projection_errors = validate_projection_plan(projection_plan)
        print("\n--- Projection Strategy ---")
        pt = projection_plan.primary_target
        print(
            f"Primary target: {pt.language} ({pt.purpose}), confidence={pt.confidence:.2f}"
        )
        if projection_plan.secondary_targets:
            print("Secondary targets:")
            for t in projection_plan.secondary_targets:
                print(
                    f"- {t.language} ({t.purpose}), confidence={t.confidence:.2f}: "
                    f"{'; '.join(t.reasons[:2])}"
                )
        else:
            print("Secondary targets: none")
        for n in projection_plan.strategy_notes:
            print(f"Note: {n}")
        if projection_errors:
            print("Projection strategy validation: failed.")
            for err in projection_errors:
                print(err)
        else:
            print("Projection strategy validation: passed.")

        print("\n--- Projection Strategy Report ---")
        print(
            json.dumps(
                projection_plan_to_json(projection_plan),
                indent=2,
                ensure_ascii=False,
                sort_keys=True,
            )
        )

        domain_profile = analyze_ir_domains(ir_normalized)
        print("\n--- Domain Analysis ---")
        print(json.dumps(domain_profile, indent=2, ensure_ascii=False, sort_keys=True))

        orchestrator = SystemOrchestrator(ir_normalized)
        orch_output = orchestrator.run()
        print("\n--- Projection Graph ---")
        print(
            json.dumps(
                orchestrator_to_json(orch_output)["orchestrator_output"]["graph"],
                indent=2,
                ensure_ascii=False,
                sort_keys=True,
            )
        )
        print("\n--- Multi-Target Artifacts ---")
        print(
            json.dumps(
                orch_output["artifacts"],
                indent=2,
                ensure_ascii=False,
                sort_keys=True,
            )
        )
        print("\n--- Projection Consistency ---")
        if orch_output["consistency_errors"]:
            for err in orch_output["consistency_errors"]:
                print(err)
        else:
            print("Projection consistency validation passed.")

        print("\n--- Orchestrator Report ---")
        print(
            json.dumps(
                orchestrator_to_json(orch_output),
                indent=2,
                ensure_ascii=False,
                sort_keys=True,
            )
        )

        v4_output = orchestrator.run_v4()
        v6_output = SystemOrchestrator(
            ir_normalized,
            engine_mode=engine_mode,
            demo_inputs={
                "username": "alice",
                "password": "secret",
                "ip_address": "10.0.0.1",
                "last_login_ip": "10.0.0.1",
                "failed_login_count": 0,
            },
        ).run_v6()
        print("\n--- Capability Registry ---")
        cap_rows = [
            {
                "name": c.name,
                "layer": c.layer,
                "status": c.status,
                "owner": c.owner,
                "preferred_engine": resolve_preferred_engine(c.name),
            }
            for c in build_capability_registry()
        ]
        print(json.dumps(cap_rows, indent=2, ensure_ascii=False, sort_keys=True))

        print("\n--- System Manifest ---")
        print(json.dumps(build_system_manifest(), indent=2, ensure_ascii=False, sort_keys=True))

        print("\n--- Self Analysis Report ---")
        print(
            json.dumps(
                v4_output["self_analysis_report"],
                indent=2,
                ensure_ascii=False,
                sort_keys=True,
            )
        )

        print("\n--- Maintenance / Pruning ---")
        print(json.dumps(v4_output["maintenance"], indent=2, ensure_ascii=False, sort_keys=True))
        if platform_mode:
            print("Routing mode: integrated_platform (rust_primary + python_projection_orchestration)")
        else:
            print("Routing mode: mixed_path (python_fallback + rust_preferred policy)")

        print("\n--- Engine Ownership ---")
        print(
            json.dumps(
                {
                    "rust_owned": [
                        "ir_validation",
                        "ir_handoff_compatibility",
                        "ir_semantic_analysis",
                        "guarantee_extraction",
                        "execution_planning",
                        "ir_execution",
                        "after_state_summary",
                    ],
                    "python_owned": [
                        "parser_normalization_entry",
                        "bridge_orchestration_fallback",
                        "editor_application_shell_support",
                        "non_critical_tooling",
                    ],
                    "deprecated": [
                        "coregoal_execution_path",
                        "python_semantic_primary_path",
                    ],
                },
                indent=2,
                ensure_ascii=False,
                sort_keys=True,
            )
        )

        print("\n--- Rust Preferred Routing ---")
        print(
            json.dumps(
                {
                    "engine_mode": v6_output.get("engine", {}).get("mode"),
                    "chosen_engine": v6_output.get("engine", {}).get("chosen_engine"),
                    "fallback_occurred": v6_output.get("engine", {}).get("fallback_occurred"),
                    "fallback_reason": v6_output.get("engine", {}).get("fallback_reason"),
                    "routing": v6_output.get("engine", {}).get("routing"),
                },
                indent=2,
                ensure_ascii=False,
                sort_keys=True,
            )
        )

        bundle = None
        print("\n--- Rust Handoff Bundle ---")
        try:
            bundle = export_ir_bundle(ir_goal)
            print(export_ir_bundle_json(bundle))
        except ValueError as ex:
            print(f"Export error: {ex}")

        print("\n--- Export Bundle Validation ---")
        if bundle is not None:
            ev = validate_export_bundle(bundle)
            if ev:
                print("Export bundle validation failed.")
                for err in ev:
                    print(err)
            else:
                print("Export bundle validation passed.")
        else:
            print("Skipped (bundle export failed).")

        evolution_execution_result: Dict[str, Any] = {"success": True}

        if not no_demo_execute:
            demo_inputs = {
                "username": "alice",
                "password": "secret",
                "ip_address": "10.0.0.1",
                "last_login_ip": "10.0.0.1",
                "failed_login_count": 0,
            }
            if platform_mode:
                pc = PlatformController(
                    ir_normalized,
                    demo_inputs=demo_inputs,
                    engine_mode=engine_mode,
                )
                platform_full_cycle = pc.run_full_cycle()
                pr = platform_full_cycle["platform_report"]
                print("\n--- Platform Mode ---")
                print(
                    json.dumps(
                        {
                            "integrated": True,
                            "engine_mode": engine_mode,
                            "rust_primary_semantics_execution": True,
                            "projection_engine": "python",
                        },
                        indent=2,
                        ensure_ascii=False,
                        sort_keys=True,
                    )
                )
                print("\n--- Full Cycle Report ---")
                print(json.dumps(pr, indent=2, ensure_ascii=False, sort_keys=True))
                evolution_execution_result = dict(
                    pr.get("execution_result_snapshot") or {"success": True}
                )
            else:
                print("\n--- Engine Routing ---")
                routing_info, rust_exec_output, fallback_status = (
                    run_rust_pipeline_with_fallback(
                        ir_normalized,
                        demo_inputs,
                        mode=engine_mode,
                    )
                )
                print(json.dumps(routing_info, indent=2, ensure_ascii=False, sort_keys=True))

                print("\n--- Rust Execution ---")
                print(json.dumps(rust_exec_output, indent=2, ensure_ascii=False, sort_keys=True))

                print("\n--- Fallback Status ---")
                print(json.dumps(fallback_status, indent=2, ensure_ascii=False, sort_keys=True))

                print("\n--- Rust/Python Parity Report ---")
                parity = compare_rust_and_python_pipeline(ir_normalized, demo_inputs)
                print(json.dumps(parity, indent=2, ensure_ascii=False, sort_keys=True))

                print("\n--- IR Execution ---")
                ir_exec_result: Optional[IRExecutionResult] = None
                rust_exec_result = rust_exec_output.get("execution_result")
                if isinstance(rust_exec_result, dict):
                    evolution_execution_result = dict(rust_exec_result)
                    print(
                        json.dumps(
                            {
                                "engine": "rust",
                                "execution_result": rust_exec_result,
                            },
                            indent=2,
                            ensure_ascii=False,
                        )
                    )
                elif fallback_status.get("used") and isinstance(
                    fallback_status.get("python_result"), dict
                ):
                    py_exec = (
                        fallback_status.get("python_result", {})
                        .get("execution", {})
                        .get("execution_result", {})
                    )
                    evolution_execution_result = (
                        dict(py_exec) if isinstance(py_exec, dict) else {"success": False}
                    )
                    print(
                        json.dumps(
                            {
                                "engine": "python_fallback",
                                "execution_result": evolution_execution_result,
                            },
                            indent=2,
                            ensure_ascii=False,
                        )
                    )
                else:
                    print("No execution result available from Rust or Python fallback.")

                core_exec_result: Optional[ExecutionResult] = None
                if not ir_execution_only and legacy_core:
                    ir_ctx = IRExecutionContext(
                        inputs=dict(demo_inputs), world_state={}
                    )
                    ir_runtime = default_ir_runtime_impls()
                    ir_exec_result, _ir_plan = execute_ir_goal(
                        ir_normalized, ir_ctx, ir_fn_reg, ir_runtime
                    )
                    print("\n--- Legacy Execution (CoreGoal) ---")
                    demo_ctx = ExecutionContext(
                        inputs=dict(demo_inputs),
                        world_state={},
                    )
                    runtime = default_runtime_impls()
                    reg_exec = default_function_registry()
                    core_exec_result, exec_plan = execute_core_goal(
                        core, demo_ctx, reg_exec, runtime
                    )
                    execution_dump = {
                        "execution_plan": execution_plan_to_json(exec_plan),
                        "execution_result": execution_result_to_json(core_exec_result),
                    }
                    print(json.dumps(execution_dump, indent=2, ensure_ascii=False))
                elif not ir_execution_only:
                    print(
                        "\n--- Legacy Execution (CoreGoal) ---\n"
                        "Skipped (IR-primary pipeline). Use --legacy-core to run CoreGoal execution."
                    )

                print("\n--- Execution Consistency ---")
                if ir_execution_only:
                    print("Skipped (running with --ir-execution-only).")
                elif not legacy_core:
                    print(
                        "Skipped (IR-primary pipeline; CoreGoal vs IR comparison needs --legacy-core)."
                    )
                elif ir_exec_result is None:
                    print("Skipped (IR execution object unavailable).")
                elif core_exec_result is None:
                    print("Skipped (legacy core execution unavailable).")
                else:
                    consistency_errors = compare_core_vs_ir_execution(
                        core_exec_result, ir_exec_result
                    )
                    if consistency_errors:
                        print("Consistency check failed.")
                        for err in consistency_errors:
                            print(err)
                    else:
                        print("Consistency check passed.")

        if platform_full_cycle is not None:
            evolved_ir = platform_full_cycle["detail"]["ir_final"]
            evolution_report = platform_full_cycle["detail"]["evolution_report"]
        else:
            evolved_ir, evolution_report = evolve_ir(
                ir_normalized,
                max_iterations=3,
                semantic_report=ir_sem_report,
                execution_result=evolution_execution_result,
                projection_plan=projection_plan,
                artifacts=orch_output.get("artifacts", []),
                consistency_errors=orch_output.get("consistency_errors", []),
            )
        print("\n--- Self Evolution ---")
        print(
            json.dumps(
                ir_goal_to_json(evolved_ir),
                indent=2,
                ensure_ascii=False,
                sort_keys=True,
            )
        )
        print("\n--- Evolution Report ---")
        print(json.dumps(evolution_report, indent=2, ensure_ascii=False, sort_keys=True))

        internal_library = build_internal_ir_library()
        library_dump = {
            k: ir_goal_to_json(v)["ir_goal"] for k, v in sorted(internal_library.items())
        }
        print("\n--- Internal IR Library ---")
        print(json.dumps(library_dump, indent=2, ensure_ascii=False, sort_keys=True))

        system_self_ir = system_to_ir_description(build_system_manifest())
        print("\n--- System Self Description ---")
        print(
            json.dumps(
                ir_goal_to_json(system_self_ir),
                indent=2,
                ensure_ascii=False,
                sort_keys=True,
            )
        )

        consistency = validate_internal_ir_consistency(internal_library)
        internal_exec = execute_internal_ir_library(internal_library)
        internal_proj = project_internal_ir_library(internal_library)
        print("\n--- Self Consistency ---")
        print(
            json.dumps(
                {
                    "errors": consistency,
                    "ok": len(consistency) == 0,
                    "internal_execution": internal_exec,
                    "internal_projection": internal_proj,
                },
                indent=2,
                ensure_ascii=False,
                sort_keys=True,
            )
        )

        shell = InternalApplicationShell(
            ir_normalized,
            engine_mode=engine_mode,
            demo_inputs={
                "username": "alice",
                "password": "secret",
                "ip_address": "10.0.0.1",
                "last_login_ip": "10.0.0.1",
                "failed_login_count": 0,
            },
        )
        projection_for_threshold = choose_projection_targets(
            ir_normalized,
            ir_sem_report,
            execution_summary=None,
            context=None,
        )
        generation_plan = build_generation_plan(ir_normalized, projection_for_threshold)
        generation_preview_artifacts = generate_all_targets(ir_normalized, projection_for_threshold)
        artifact_validation_errors = validate_generated_artifacts(generation_preview_artifacts)
        threshold_preview = can_generate_simple_website(
            ir_normalized,
            projection_for_threshold,
            generation_preview_artifacts,
        )
        print("\n--- Generation Plan ---")
        print(json.dumps(generation_plan, indent=2, ensure_ascii=False, sort_keys=True))
        print("\n--- Generated Artifacts Validation ---")
        print(
            json.dumps(
                {
                    "passed": len(artifact_validation_errors) == 0,
                    "errors": artifact_validation_errors,
                },
                indent=2,
                ensure_ascii=False,
                sort_keys=True,
            )
        )
        print("\n--- Simple Website Threshold Test ---")
        print(json.dumps(threshold_preview, indent=2, ensure_ascii=False, sort_keys=True))

        if not bool(threshold_preview.get("passed")):
            raise RuntimeError(
                "Application shell release gate blocked: simple website generation threshold is not passed."
            )

        shell_status = shell.shell_status()
        generation_result = shell.build_simple_website()
        success_gate = website_success_gate(generation_result)
        git_readiness_errors = validate_git_checkpoint_readiness(
            generation_result=generation_result,
            shell_status=shell_status,
        )
        checkpoint_package = build_checkpoint_package(
            shell_status=shell_status,
            generation_result=generation_result,
        )

        print("\n--- Application Shell Status ---")
        print(
            json.dumps(
                {
                    "system_manifest": build_system_manifest(),
                    "capability_registry": [
                        {
                            "name": c.name,
                            "layer": c.layer,
                            "status": c.status,
                            "owner": c.owner,
                        }
                        for c in build_capability_registry()
                    ],
                    "editor_session_status": {
                        "history": shell_status.get("editor_history", {}),
                        "diagnostics": shell_status.get("editor_diagnostics", []),
                    },
                    "generation_report": {
                        "artifact_validation": generation_result.get("artifact_validation", {}),
                        "consistency_errors": generation_result.get("consistency_errors", []),
                        "artifacts_count": len(generation_result.get("artifacts", [])),
                    },
                    "website_threshold_result": generation_result.get("threshold_test", {}),
                    "git_checkpoint_readiness": {
                        "ok": len(git_readiness_errors) == 0,
                        "errors": git_readiness_errors,
                    },
                },
                indent=2,
                ensure_ascii=False,
                sort_keys=True,
            )
        )

        print("\n--- Website Success Gate ---")
        print(
            json.dumps(
                {
                    "passed": success_gate,
                    "ready_for_checkpoint_commit": bool(
                        generation_result.get("ready_for_checkpoint_commit")
                    ),
                },
                indent=2,
                ensure_ascii=False,
                sort_keys=True,
            )
        )

        print("\n--- Git Checkpoint Readiness ---")
        push_recommended = success_gate and (len(git_readiness_errors) == 0)
        push_report = {
            "github_push_recommended": push_recommended,
            "errors": git_readiness_errors,
            "branch_recommendation": "checkpoint/v6.3-internal-shell",
            "commit_message_suggestion": (
                "feat(v6.3): add internal application shell, website success gate, "
                "and git checkpoint readiness workflow"
            ),
            "clean_repo_state_guidance": [
                "Review and stage only canonical IR, shell, and docs changes.",
                "Ensure generated artifacts policy is explicit (.gitignore or tracked strategy).",
                "Run local parser/orchestrator shell checks before commit.",
            ],
            "checkpoint_package": checkpoint_package,
        }
        print(json.dumps(push_report, indent=2, ensure_ascii=False, sort_keys=True))

        with open("checkpoint_push_readiness.md", "w", encoding="utf-8") as f:
            f.write("# Checkpoint Push Readiness (V6.3)\\n\\n")
            f.write(f"- github_push_recommended: {'true' if push_recommended else 'false'}\\n")
            f.write(f"- website_success_gate_passed: {'true' if success_gate else 'false'}\\n")
            f.write(
                f"- git_checkpoint_readiness_ok: {'true' if len(git_readiness_errors) == 0 else 'false'}\\n\\n"
            )
            f.write("## Branch Recommendation\\n\\n")
            f.write("- `checkpoint/v6.3-internal-shell`\\n\\n")
            f.write("## Commit Message Suggestion\\n\\n")
            f.write(
                "- `feat(v6.3): add internal application shell, website success gate, and git checkpoint readiness workflow`\\n\\n"
            )
            if git_readiness_errors:
                f.write("## Blocking Issues\\n\\n")
                for err in git_readiness_errors:
                    f.write(f"- {err}\\n")
            else:
                f.write("## Blocking Issues\\n\\n- none\\n")

    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    main()
