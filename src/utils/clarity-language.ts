import { LanguageSupport, StreamLanguage, StreamParser } from "@codemirror/language";
import { autocompletion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { linter, Diagnostic } from '@codemirror/lint';

// Define declarations
const defineKeywords = [
  "define-public",
  "define-private", 
  "define-read-only",
  "define-map",
  "define-data-var", 
  "define-constant",
  "define-fungible-token",
  "define-non-fungible-token",
  "define-trait",
  "impl-trait",
  "use-trait",
  "define-versioned",
  "define-persistent-map",
  "define-dynamic-contract",
];

// Control flow keywords
const controlKeywords = [
  "let",
  "begin",
  "if",
  "match",
  "asserts!",
  "try!",
  "unwrap!",
  "unwrap-err!",
  "unwrap-panic",
  "unwrap-err-panic",
  "var-get",
  "var-set",
  "map-get?",
  "map-set",
  "map-insert",
  "map-delete",
  "match-let",
  "return-err",
  "return-ok",
];

// Built-in functions
const builtinFunctions = [
  // Principal related
  "principal-destruct?",
  "principal-construct?",

  "match-response",
  "unwrap-safe",
  "unwrap-err-safe",
  "unwrap-ret",
  "unwrap-err-ret",

  "buff-to-hex",
  "hex-to-buff", 
  "buff-to-utf8",
  "utf8-to-buff",
  "buff-to-string-ascii",
  "string-ascii-to-buff",
  "buff-to-string-utf8",
  "string-utf8-to-buff",

  "ft-get-name",
  "ft-get-symbol",
  "ft-get-decimals", 
  "ft-get-token-uri",
  "nft-get-token-uri",

  "map-delete?",
  "map-insert?",
  "fold-left",
  "fold-right",
  "filter-not",
  "find-index",
  "find-value",

  "is-contract-caller",
  "get-caller-public-key",
  "get-contract-caller",

  "get-burn-block-info?",
  "get-btc-header-hash",
  "get-btc-block-height",

  "get-tuple-field",
  "set-tuple-field",
  "insert-at",
  "remove-at",
  "slice",
  "reverse",

  "tx-hash",
  "tx-block-height",
  "tx-fee-rate",
  "tx-nonce",
  "tx-public-key",
  "tx-raw",

  "pox-addr",
  "pox-addr-to-tuple",
  "tuple-to-pox-addr",

  "to-consensus-buff?",
  "from-consensus-buff?",
  "is-standard",
  "is-in-mainnet",
  "is-in-testnet",

  "nft-get-next-token-id",
  "nft-has-token?",
  "ft-get-balance-fixed",
  "ft-get-total-supply-fixed", 
  "ft-decimals",

  "pox-get-reward-set",
  "pox-get-reward-cycle-length",
  "pox-get-reward-cycle-index",
  "pox-get-total-stacked",
  "pox-get-threshold",

  "modular-add",
  "modular-mul",
  "modular-pow",
  "min",
  "max",
  "abs",
  "to-precision",
  "from-precision",

  "buffer-concat",
  "buffer-length",
  "string-length",
  "string-pad-left",
  "string-pad-right", 
  "string-replace",
  "string-substring",

  "get-block-info-property",
  "get-burn-block-info-property",
  "validate-principal",
  "principal-standardize?",
  "principal-destruct-maybe?",
  "principal-construct-maybe?",

  "map-set?",
  "map-insert-many?",
  "map-delete-many?",
  "fold-while",
  "index-where",
  "all?",
  "any?",
  "none?",

  "get-epoch-time-ms",
  "get-block-time",
  "get-block-timestamp",
  "get-burnchain-header-hash",
  "get-burnchain-height",

  "nft-get-supply?",
  "nft-mint-many?",
  "nft-burn-many?",
  "nft-get-collection-uri",
  "nft-get-token-metadata",

  "merge-union",
  "merge-subtract",
  "merge-drop", 
  "tuple-merge",
  "tuple-select",

  "stx-account",
  "stx-burn-many?",
  "stx-transfer-many?",
  "stx-get-account-info",

  // Contract interaction
  "contract-call?",
  "as-contract",
  "contract-of",
  "principal-of",
  "at-block", 
  "get-block-info",

  // STX token functions
  "stx-get-balance",
  "stx-burn?",
  "stx-transfer?",
  "stx-transfer-memo?",

  // Fungible token functions
  "ft-transfer?",
  "ft-mint?",
  "ft-burn?",
  "ft-get-balance",
  "ft-get-supply",

  // Non-fungible token functions
  "nft-transfer?", 
  "nft-mint?",
  "nft-burn?",
  "nft-get-owner?",

  // Sequence functions
  "map",
  "fold",
  "filter",
  "append",
  "concat",
  "len",
  "element-at?",
  "index-of?",

  // Data structure functions
  "list",
  "tuple",
  "get",
  "merge",

  // Type conversion 
  "to-int",
  "to-uint",
  "buff-to-int-be",
  "buff-to-int-le",
  "buff-to-uint-be",
  "buff-to-uint-le",

  // Crypto functions
  "sha256",
  "sha512",
  "sha512/256",
  "keccak256",
  "secp256k1-recover?",
  "secp256k1-verify",

  // Other utilities
  "print",
  "default-to",
  "some",
  "ok",
  "err",
  "is-ok",
  "is-err", 
  "is-none",
  "is-some",
  "get-block-info?",

  // Type checks
  "is-eq",
  "is-some",
  "is-none",
  "is-ok",
  "is-err",

  // Math operations
  "mod",
  "pow", 
  "sqrti",
  "log2",
  "bit-and",
  "bit-or",
  "bit-xor", 
  "bit-not",
  "bit-shift-left",
  "bit-shift-right",

  // String/conversion functions
  "string-to-int?",
  "string-to-uint?",
  "int-to-ascii",
  "int-to-utf8",

  // Response handlers
  "ok",
  "err",
  "try!",
  "asserts!",

  // Option handlers
  "some",
  "none",

  // Lists/sequences
  "list",
  "append",
  "concat",
  "as-max-len?",
  "slice?",
  "replace-at?",

  // BNS (Bitcoin Name System) functions
  "name-resolve",
  "resolve-principal",
  "name-preorder",
  "name-register",
  "name-update",
  "name-transfer",
  "name-revoke",
  "name-renewal",

  // PoX (Proof of Transfer) functions
  "delegate-stx",
  "delegate-stack-stx",
  "stack-stx",
  "stack-increase",
  "stack-extend",
  "stack-aggregation-commit",

  // Multi-signature functions
  "check-checker",
  "add-checker",
  "remove-checker"
];

// Constants/keywords
const constants = [
  // Blockchain context
  "tx-sender",
  "contract-caller",
  "block-height",
  "burn-block-height",
  "stx-liquid-supply",
  "chain-id",
  "is-in-mainnet",
  "is-in-regtest",

  // Blockchain constants
  "burn-block-height",
  "tx-sponsor?",
  "total-liquid-ustx",
  "stacks-node-version",

  // Contract info
  "contract-caller",
  "contract-owner",

  // Response types
  "ok",
  "err",
  "some", 
  "none",

  // Principal versions
  "ADDRESS_VERSION_MAINNET_SINGLESIG",
  "ADDRESS_VERSION_MAINNET_MULTISIG",
  "ADDRESS_VERSION_TESTNET_SINGLESIG",
  "ADDRESS_VERSION_TESTNET_MULTISIG",

  // Common error codes
  "ERR_PANIC",
  "ERR_INSUFFICIENT_FUNDS",
  "ERR_STACKING_PERMISSION_DENIED",
  "ERR_STACKING_EXPIRED",
  "ERR_STACKING_INVALID_AMOUNT",
  "ERR_STACKING_ALREADY_STACKED",
  "ERR_STACKING_ALREADY_DELEGATED",
  "ERR_STACKING_INSUFFICIENT_FUNDS",
  "ERR_NONE",
  "ERR_CONTRACT_NOT_FOUND",
  "ERR_INVALID_TOKEN",
  "ERR_UNAUTHORIZED",
  "ERR_NOT_ENOUGH_FUNDS",
  "ERR_TRANSFER_FAILED",
  "ERR_MINT_FAILED",
  "ERR_BURN_FAILED",
  "ERR_INVALID_ARGUMENT",
  "ERR_NOT_IMPLEMENTED",
  "ERR_PERMISSION_DENIED",
  "ERR_INVALID_REQUEST",
  "ERR_NOT_FOUND",
  "ERR_INVALID_SYNTAX",
  "ERR_INVALID_SIGNATURE",
  "ERR_INVALID_NFT",
  "ERR_INVALID_FT",
  "ERR_INVALID_TRAIT",
  "ERR_INVALID_MAP",
  "ERR_INVALID_LIST",
  "ERR_RUNTIME_ERROR",
  "ERR_DATA_STORE_ERROR",
  "ERR_CONTRACT_ERROR",
  "ERR_INSUFFICIENT_BALANCE",
  "ERR_INVALID_PRINCIPAL",
  "ERR_INVALID_LENGTH",
  "ERR_OUT_OF_BOUNDS",
  "ERR_TOO_MANY_ARGS",
  "ERR_CONTRACT_ALREADY_EXISTS",
  "ERR_CONTRACT_CALL_FAILED",

  // Boolean constants
  "true",
  "false",

  // Special values
  "none",

  // Common responses
  "ok",
  "err"
];

// Arithmetic operators
const operators = [
  "+",
  "-",
  "*",
  "/",
  ">",
  ">=",
  "<",
  "<=",
  "pow"
];

// Logic operators
const logicOperators = [
  "and",
  "or", 
  "not",
  "is-eq"
];

// Type signatures
const typeSignatures = [
  "uint",
  "int",
  "bool",
  "principal",
  "(buff N)",
  "(string-ascii N)",
  "(string-utf8 N)",
  "(list N type)",
  "(optional type)",
  "(response ok-type err-type)",
  "(tuple ...)",
  "trait",
  "(map key-type value-type)",
  "(define-trait trait-name ((func-name (param-types) (return-type))))",
  "(define-map map-name key-tuple value-tuple)",
  "(buff 32)",
  "(buff 64)",
  "(buff 128)",
  "(string-ascii 32)",
  "(string-ascii 64)", 
  "(string-ascii 128)",
  "(string-ascii 256)",
  "(list 10 principal)",
  "(list 100 uint)",
  "(list 1000 bool)",
  "(string-utf8 1024)",
  "(string-utf8 4096)",
  "(buff 512)",
  "(optional-default type default-value)",
  "(ns-trait)",
  "(ft-trait)",
  "(nft-trait)", 
  "(impl-trait interface-name)",
  "(define-public-trait trait-name ((method-name (args) (response))))",
  "(define-trait-interface interface-name)",
  "(string-utf8 2048)",
  "(string-utf8 8192)",
  "(buff 256)",
  "(buff 1024)",
  "(list 500 int)",
  "(list 250 principal)",
  "(response {ok: type} {err: type})",
  "(map-set key-tuple value-tuple)",
  "(map-get key-tuple)",
  "(trait-reference trait-name)",
  "(default-to default value)"
];

const parser: StreamParser<{}> = {
  token(stream, state) {
    if (stream.eatSpace()) return null;
    
    // Comments
    if (stream.match(/;.*/)) return "comment";
    
    // Brackets/parens
    if (stream.match(/[(){}\[\]]/)) return "bracket";
    
    // Type signatures - add this before the word matching
    if (stream.match(/\([a-zA-Z0-9-]+\s+[0-9]+\)/)) {
      return "type";
    }
    
    // Match words
    if (stream.match(/[a-zA-Z-?!]+/)) {
      const word = stream.current();
      if (defineKeywords.includes(word)) return "definitionKeyword";
      if (controlKeywords.includes(word)) return "controlKeyword";
      if (builtinFunctions.includes(word)) return "function";
      if (constants.includes(word)) return "atom";
      if (operators.includes(word)) return "operator";
      if (logicOperators.includes(word)) return "operator";  
      if (typeSignatures.includes(word)) return "type";
      return "variable";
    }
    
    // Numbers (with optional u prefix)
    if (stream.match(/u?[0-9]+/)) return "number";
    
    // Strings 
    if (stream.match(/"(?:[^"\\]|\\.)*"/)) return "string";
    
    // Buffers
    if (stream.match(/0x[0-9a-fA-F]*/)) return "string";
    
    // Principals
    if (stream.match(/'[A-Z0-9]+/)) return "string";
    
    stream.next();
    return null;
  }
};

const clarityCompletions = (context: CompletionContext): CompletionResult | null => {
    let word = context.matchBefore(/\w+/);
    if (word === null || (word.from === word.to && !context.explicit)) return null;
  
    return {
      from: word.from,
      options: [
        ...defineKeywords.map(k => ({ 
          label: k, 
          type: "keyword",
          detail: "Definition keyword"
        })),
        ...controlKeywords.map(k => ({ 
          label: k, 
          type: "keyword",
          detail: "Control flow" 
        })),
        ...builtinFunctions.map(f => ({ 
          label: f, 
          type: "function",
          detail: "Built-in function"
        })),
        ...constants.map(c => ({ 
          label: c, 
          type: "constant",
          detail: "Constant value"
        })),
        ...operators.map(o => ({
          label: o,
          type: "operator",
          detail: "Arithmetic operator"
        })),
        ...logicOperators.map(o => ({
          label: o, 
          type: "operator",
          detail: "Logic operator"
        })),
        ...typeSignatures.map(t => ({
          label: t,
          type: "type",
          detail: "Type signature"
        }))
      ]
    };
  };
  
  const clarityLinter = linter((view) => {
    const diagnostics: Diagnostic[] = [];
    const text = view.state.doc.toString();
    
    // Check for definitions
    if (!text.includes('(define-')) {
      diagnostics.push({
        from: 0,
        to: view.state.doc.length,
        severity: 'warning',
        message: 'Contract should include at least one definition'
      });
    }
  
    // Check for potential trait implementation issues
    if (text.includes('impl-trait') && text.includes('define-public')) {
      const traitMatch = text.match(/impl-trait\s+([^\s)]+)/);
      if (traitMatch) {
        const traitName = traitMatch[1];
        // Search for required public functions
        diagnostics.push({
          from: 0,
          to: view.state.doc.length,
          severity: 'warning',
          message: `Verify all functions required by ${traitName} are implemented`
        });
      }
    }
  
    // Check for potential NFT/FT supply issues
    if ((text.includes('define-fungible-token') || text.includes('define-non-fungible-token')) 
        && !text.includes('total-supply')) {
      diagnostics.push({
        from: 0,
        to: view.state.doc.length,
        severity: 'warning',
        message: 'Consider defining total supply for tokens'
      });
    }
  
    // Check for map access without unwrapping
    if (text.includes('map-get?') && !text.match(/(unwrap|try|match)/)) {
      diagnostics.push({
        from: 0,
        to: view.state.doc.length,
        severity: 'warning',
        message: 'Map access should handle none case'
      });
    }
  
    // Check for potential recursive calls (not allowed in Clarity)
    if (text.match(/(\w+)(?=\s*\([^)]*\)\s*\([^)]*\1)/)) {
      diagnostics.push({
        from: 0,
        to: view.state.doc.length,
        severity: 'warning',
        message: 'Potential recursive call detected (not allowed in Clarity)'
      });
    }
  
    // Check for unbounded lists
    if (text.includes('(list ') && !text.match(/\(list\s+\d+/)) {
      diagnostics.push({
        from: 0,
        to: view.state.doc.length,
        severity: 'error',
        message: 'Lists must have a specified maximum length'
      });
    }
  
    // Check parentheses balance
    let balance = 0;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '(') balance++;
      if (text[i] === ')') balance--;
      if (balance < 0) {
        diagnostics.push({
          from: i,
          to: i + 1,
          severity: 'error',
          message: 'Unbalanced parentheses'
        });
        break;
      }
    }
    if (balance > 0) {
      diagnostics.push({
        from: text.length - 1,
        to: text.length,
        severity: 'error',
        message: 'Unbalanced parentheses'
      });
    }
  
    return diagnostics;
  });
  
  export function clarityLanguage(): LanguageSupport {
    return new LanguageSupport(
      StreamLanguage.define(parser),
      [
        autocompletion({ override: [clarityCompletions] }),
        clarityLinter
      ]
    );
  }