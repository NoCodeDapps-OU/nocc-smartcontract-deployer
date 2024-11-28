import { LanguageSupport, StreamLanguage, StreamParser, StringStream } from "@codemirror/language";
import { autocompletion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { linter, Diagnostic } from '@codemirror/lint';

// Add these interfaces at the top of the file
interface CompletionTemplate {
  label: string;
  type: string;
  detail: string;
  apply: (view: any, completion: any, from: number, to: number) => void;
}

interface CompletionOption {
  label: string;
  type: string;
  detail: string;
  boost?: number;
  apply?: (view: any, completion: any, from: number, to: number) => void;
}

// Add this helper function at the top
const findEndOfSection = (state: any, endPattern: RegExp): number => {
  let line = state.line.number;
  const doc = state.doc;
  
  while (line < doc.lines) {
    const lineText = doc.line(line + 1).text;
    if (endPattern.test(lineText)) {
      return doc.line(line).to;
    }
    line++;
  }
  
  return doc.length;
};

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
  "filter",
  "fold",
  "map",
  "default-to",
  "get-block-info?",
  "contract-call?",
  "as-contract",
  "contract-of",
  "principal-of",
  "at-block",
  "to-consensus-buff?",
  "from-consensus-buff?"
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
  "remove-checker",

  // Additional arithmetic functions
  "pow",
  "sqrti",
  "log2",
  "mod",
  
  // Additional comparison functions
  "is-eq",
  "is-not",
  
  // Additional list functions
  "append",
  "as-max-len?",
  "len",
  "list",
  "map",
  
  // Additional string functions
  "concat",
  "as-max-len?",
  "index-of?",
  "replace",
  
  // Additional buffer functions
  "to-uint",
  "to-int",
  "slice?",
  "concat",
  
  // Additional principal functions
  "stx-get-balance",
  "stx-burn?",
  "stx-transfer?",
  
  // Additional NFT functions
  "nft-get-owner?",
  "nft-transfer?",
  "nft-burn?",
  
  // Additional FT functions
  "ft-get-balance",
  "ft-transfer?",
  "ft-mint?",
  "ft-burn?",
  
  // Additional blockchain functions
  "get-block-info?",
  "get-burn-block-info?",
  
  // Additional tuple functions
  "merge",
  "get",
  
  // Additional response functions
  "match",
  "match-err",
  "match-ok",
  
  // Additional optional functions
  "to-optional",
  "some",
  "none",
  
  // Additional trait functions
  "contract-of",
  "principal-of",
  
  // Additional hash functions
  "sha256",
  "keccak256",
  "hash160",
  
  // Additional secp256k1 functions
  "secp256k1-recover?",
  "secp256k1-verify",
  
  // Additional time functions
  "get-epoch-time",
  "get-epoch-time-ms"
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
  "(default-to default value)",
  "int128",
  "uint128",
  "int256",
  "uint256",
  "(buff 20)",
  "(buff 33)",
  "(buff 65)",
  "(string-utf8 512)",
  "(string-utf8 1024)",
  "(list 32 uint)",
  "(list 64 int)",
  "(list 128 bool)",
  "(response uint uint)",
  "(response bool uint)",
  "(response principal uint)",
  "(optional uint)",
  "(optional principal)",
  "(optional bool)",
  "{key: value}",
  "{name: string, id: uint}",
  "(define-trait-interface interface-name)",
  "(use-trait trait-alias trait-identifier)"
];

// Add section folding markers
const foldingRanges = [
  {start: /;; traits/, end: /^(?=;; token)/},
  {start: /;; token definitions/, end: /^(?=;; constants)/},
  {start: /;; constants/, end: /^(?=;; data vars)/},
  {start: /;; data vars/, end: /^(?=;; data maps)/},
  {start: /;; data maps/, end: /^(?=;; public functions)/},
  {start: /;; public functions/, end: /^(?=;; read only functions)/},
  {start: /;; read only functions/, end: /^(?=;; private functions)/},
  {start: /;; private functions/, end: /$/}
];

// Merge all templates into a single object
const templates: Record<string, CompletionTemplate> = {
  // Define templates
  'define-public': {
    label: 'define-public',
    type: 'keyword',
    detail: 'Define public function',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(define-public (function-name (param1 type1) (param2 type2))\n  (ok true)\n)'
        }
      });
    }
  },
  'define-private': {
    label: 'define-private',
    type: 'keyword',
    detail: 'Define private function',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(define-private (function-name (param1 type1) (param2 type2))\n  true\n)'
        }
      });
    }
  },
  'define-read-only': {
    label: 'define-read-only',
    type: 'keyword',
    detail: 'Define read-only function',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(define-read-only (function-name (param1 type1) (param2 type2))\n  true\n)'
        }
      });
    }
  },
  'define-map': {
    label: 'define-map',
    type: 'keyword',
    detail: 'Define data map',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(define-map map-name {\n  key1: type1,\n  key2: type2\n} {\n  val1: type1,\n  val2: type2\n})'
        }
      });
    }
  },
  'define-data-var': {
    label: 'define-data-var',
    type: 'keyword',
    detail: 'Define data variable',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(define-data-var var-name type initial-value)'
        }
      });
    }
  },
  'define-constant': {
    label: 'define-constant',
    type: 'keyword',
    detail: 'Define constant',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(define-constant constant-name value)'
        }
      });
    }
  },
  'define-fungible-token': {
    label: 'define-fungible-token',
    type: 'keyword',
    detail: 'Define fungible token',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(define-fungible-token token-name u1000000)'
        }
      });
    }
  },
  'define-non-fungible-token': {
    label: 'define-non-fungible-token',
    type: 'keyword',
    detail: 'Define non-fungible token',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(define-non-fungible-token token-name {\n  token-id: uint,\n  token-uri: (string-ascii 256)\n})'
        }
      });
    }
  },
  'define-trait': {
    label: 'define-trait',
    type: 'keyword',
    detail: 'Define trait',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(define-trait trait-name (\n  (function-name (param1 type1) (response ok-type err-type))\n))'
        }
      });
    }
  },

  // ... continue with other unique templates ...

  // Arithmetic operators
  '+': {
    label: '+',
    type: 'operator',
    detail: 'Addition',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(+ value1 value2)'
        }
      });
    }
  },
  '-': {
    label: '-',
    type: 'operator',
    detail: 'Subtraction',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(- value1 value2)'
        }
      });
    }
  },
  '*': {
    label: '*',
    type: 'operator',
    detail: 'Multiplication',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(* value1 value2)'
        }
      });
    }
  },
  '/': {
    label: '/',
    type: 'operator',
    detail: 'Division',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(/ value1 value2)'
        }
      });
    }
  },

  // Comparison operators
  '>': {
    label: '>',
    type: 'operator',
    detail: 'Greater than',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(> value1 value2)'
        }
      });
    }
  },
  '>=': {
    label: '>=',
    type: 'operator',
    detail: 'Greater than or equal',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(>= value1 value2)'
        }
      });
    }
  },
  '<': {
    label: '<',
    type: 'operator',
    detail: 'Less than',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(< value1 value2)'
        }
      });
    }
  },
  '<=': {
    label: '<=',
    type: 'operator',
    detail: 'Less than or equal',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(<= value1 value2)'
        }
      });
    }
  },

  // STX Functions
  'stx-transfer?': {
    label: 'stx-transfer?',
    type: 'function',
    detail: 'Transfer STX tokens',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(stx-transfer? amount sender recipient)'
        }
      });
    }
  },
  'stx-burn?': {
    label: 'stx-burn?',
    type: 'function',
    detail: 'Burn STX tokens',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(stx-burn? amount sender)'
        }
      });
    }
  },

  // NFT Functions
  'nft-mint?': {
    label: 'nft-mint?',
    type: 'function',
    detail: 'Mint NFT token',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(nft-mint? token-name token-id recipient)'
        }
      });
    }
  },
  'nft-burn?': {
    label: 'nft-burn?',
    type: 'function',
    detail: 'Burn NFT token',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(nft-burn? token-name token-id sender)'
        }
      });
    }
  },

  // Block Info Functions
  'get-block-info?': {
    label: 'get-block-info?',
    type: 'function',
    detail: 'Get block information',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(get-block-info? property-name block-height)'
        }
      });
    }
  },

  // Principal Functions
  'is-standard': {
    label: 'is-standard',
    type: 'function',
    detail: 'Check if principal is standard',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(is-standard principal)'
        }
      });
    }
  },
  'is-contract': {
    label: 'is-contract',
    type: 'function',
    detail: 'Check if principal is contract',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(is-contract principal)'
        }
      });
    }
  },

  // Buffer Functions
  'len': {
    label: 'len',
    type: 'function',
    detail: 'Get length of buffer/string/list',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(len value)'
        }
      });
    }
  },

  // String Functions
  'string-utf8-length?': {
    label: 'string-utf8-length?',
    type: 'function',
    detail: 'Get UTF8 string length',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(string-utf8-length? string-value)'
        }
      });
    }
  },

  // List Functions
  'append': {
    label: 'append',
    type: 'function',
    detail: 'Append to list',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(append list-value item)'
        }
      });
    }
  },
  'filter': {
    label: 'filter',
    type: 'function',
    detail: 'Filter list',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(filter predicate-function list)'
        }
      });
    }
  },

  // Built-in keywords
  'tx-sender': {
    label: 'tx-sender',
    type: 'keyword',
    detail: 'Get transaction sender principal',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: 'tx-sender'
        }
      });
    }
  },
  'contract-caller': {
    label: 'contract-caller',
    type: 'keyword',
    detail: 'Get the principal that called the current function',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: 'contract-caller'
        }
      });
    }
  },
  'block-height': {
    label: 'block-height',
    type: 'keyword',
    detail: 'Get current block height',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: 'block-height'
        }
      });
    }
  },
  'burn-block-height': {
    label: 'burn-block-height',
    type: 'keyword',
    detail: 'Get current burn chain block height',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: 'burn-block-height'
        }
      });
    }
  },

  // Principal functions
  'principal-of?': {
    label: 'principal-of?',
    type: 'function',
    detail: 'Get principal from public key',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(principal-of? public-key)'
        }
      });
    }
  },

  // Response handling
  'is-ok': {
    label: 'is-ok',
    type: 'function',
    detail: 'Check if response is ok',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(is-ok value)'
        }
      });
    }
  },
  'is-err': {
    label: 'is-err',
    type: 'function',
    detail: 'Check if response is error',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(is-err value)'
        }
      });
    }
  },
  'is-none': {
    label: 'is-none',
    type: 'function',
    detail: 'Check if optional is none',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(is-none value)'
        }
      });
    }
  },
  'is-some': {
    label: 'is-some',
    type: 'function',
    detail: 'Check if optional has value',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(is-some value)'
        }
      });
    }
  },
  'element-at': {
    label: 'element-at',
    type: 'function',
    detail: 'Get element at index',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(element-at list index)'
        }
      });
    }
  },
  'index-of': {
    label: 'index-of',
    type: 'function',
    detail: 'Find index of element',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(index-of list value)'
        }
      });
    }
  },

  // Tuple functions
  'get': {
    label: 'get',
    type: 'function',
    detail: 'Get tuple field',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(get key-name tuple-value)'
        }
      });
    }
  },
  'merge': {
    label: 'merge',
    type: 'function',
    detail: 'Merge tuples',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(merge tuple1 tuple2)'
        }
      });
    }
  },

  // String functions
  'to-uint': {
    label: 'to-uint',
    type: 'function',
    detail: 'Convert string to uint',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(to-uint value)'
        }
      });
    }
  },
  'to-int': {
    label: 'to-int',
    type: 'function',
    detail: 'Convert string to int',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(to-int value)'
        }
      });
    }
  },

  // Buffer functions
  'to-buff': {
    label: 'to-buff',
    type: 'function',
    detail: 'Convert hex string to buffer',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(to-buff value)'
        }
      });
    }
  },

  // Contract context
  'at-block': {
    label: 'at-block',
    type: 'function',
    detail: 'Execute expression at block',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(at-block block-hash expr)'
        }
      });
    }
  },

  // Staking operations
  'stx-account': {
    label: 'stx-account',
    type: 'function',
    detail: 'Get STX account info',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(stx-account owner)'
        }
      });
    }
  },

  // FT operations
  'ft-burn?': {
    label: 'ft-burn?',
    type: 'function',
    detail: 'Burn fungible tokens',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(ft-burn? token-name amount sender)'
        }
      });
    }
  },

  // Response handling
  'try!': {
    label: 'try!',
    type: 'function',
    detail: 'Try unwrap response, return error if err',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(try! expression)'
        }
      });
    }
  },
  'asserts!': {
    label: 'asserts!',
    type: 'function',
    detail: 'Assert condition, return error if false',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(asserts! condition error-value)'
        }
      });
    }
  },

  // Map operations
  'map-delete': {
    label: 'map-delete',
    type: 'function',
    detail: 'Delete map entry',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(map-delete map-name { key: value })'
        }
      });
    }
  },

  // List operations
  'fold': {
    label: 'fold',
    type: 'function',
    detail: 'Fold over list',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(fold list initial-value func)'
        }
      });
    }
  },

  // Staking operations
  'delegate-stx': {
    label: 'delegate-stx',
    type: 'function',
    detail: 'Delegate STX tokens',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(delegate-stx amount delegate-to until-burn-ht)'
        }
      });
    }
  },

  // Trait operations
  'use-trait': {
    label: 'use-trait',
    type: 'keyword',
    detail: 'Use trait',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(use-trait trait-alias .contract-name.trait-name)'
        }
      });
    }
  },

  // Additional define templates
  'define-versioned': {
    label: 'define-versioned',
    type: 'keyword',
    detail: 'Define versioned function',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(define-versioned (function-name (param1 type1) (param2 type2))\n  (ok true)\n)'
        }
      });
    }
  },
  'define-persistent-map': {
    label: 'define-persistent-map',
    type: 'keyword',
    detail: 'Define persistent map',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(define-persistent-map map-name {\n  key1: type1,\n  key2: type2\n} {\n  val1: type1,\n  val2: type2\n})'
        }
      });
    }
  },
  'define-dynamic-contract': {
    label: 'define-dynamic-contract',
    type: 'keyword',
    detail: 'Define dynamic contract',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(define-dynamic-contract contract-name principal)'
        }
      });
    }
  },
  'define-public-trait': {
    label: 'define-public-trait',
    type: 'keyword',
    detail: 'Define public trait',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(define-public-trait trait-name (\n  (function-name (param1 type1) (response ok-type err-type))\n))'
        }
      });
    }
  },
  'define-trait-interface': {
    label: 'define-trait-interface',
    type: 'keyword',
    detail: 'Define trait interface',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(define-trait-interface interface-name (\n  (function-name (param1 type1) (response ok-type err-type))\n))'
        }
      });
    }
  },
  'define-data-map': {
    label: 'define-data-map',
    type: 'keyword',
    detail: 'Define data map',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(define-data-map map-name {\n  key1: type1,\n  key2: type2\n} {\n  val1: type1,\n  val2: type2\n})'
        }
      });
    }
  },
  'define-read-only-trait': {
    label: 'define-read-only-trait',
    type: 'keyword',
    detail: 'Define read-only trait',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(define-read-only-trait trait-name (\n  (function-name (param1 type1) (response ok-type err-type))\n))'
        }
      });
    }
  },
  'define-private-trait': {
    label: 'define-private-trait',
    type: 'keyword',
    detail: 'Define private trait',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(define-private-trait trait-name (\n  (function-name (param1 type1) (response ok-type err-type))\n))'
        }
      });
    }
  },
  'sha256': {
    label: 'sha256',
    type: 'function',
    detail: 'Calculate SHA256 hash',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(sha256 value)'
        }
      });
    }
  },
  'secp256k1-verify': {
    label: 'secp256k1-verify',
    type: 'function',
    detail: 'Verify secp256k1 signature',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(secp256k1-verify message-hash signature public-key)'
        }
      });
    }
  },
  'get-epoch-time': {
    label: 'get-epoch-time',
    type: 'function',
    detail: 'Get current epoch time in seconds',
    apply: (view: any, completion: any, from: number, to: number) => {
      view.dispatch({
        changes: {
          from,
          to,
          insert: '(get-epoch-time)'
        }
      });
    }
  }
};

// Add syntax highlighting rules
const syntaxHighlighting = {
  tokenizer: {
    root: [
      // Comments
      [/;;.*$/, 'comment'],
      
      // Section headers
      [/^;; (traits|token definitions|constants|data vars|data maps|public functions|read only functions|private functions)/, 'keyword'],
      
      // Keywords
      [/(define-[a-z-]+)/, 'keyword'],
      
      // Built-in functions
      [/\b(map-get\?|map-set|map-delete|var-get|var-set|ok|err|some|none|try!|unwrap!|unwrap-err!|unwrap-panic|is-ok|is-err|is-some|is-none|ft-mint\?|ft-transfer\?|nft-mint\?|nft-transfer\?|stx-transfer\?|contract-call\?|as-contract|begin|let|match|asserts!)\b/, 'function'],
      
      // Types
      [/\b(uint|int|bool|principal|buff|string-ascii|string-utf8|list|optional|response|tuple)\b/, 'type'],
      
      // Numbers
      [/u\d+/, 'number'],
      [/\d+/, 'number'],
      
      // Strings
      [/"[^"]*"/, 'string'],
      
      // Principals
      [/'[A-Z0-9]+/, 'string'],
      
      // Parentheses
      [/[\(\)]/, 'delimiter'],
      
      // Special tokens
      [/\b(true|false|none)\b/, 'atom'],
      
      // Contract calls
      [/\.[a-zA-Z][a-zA-Z0-9_-]*/, 'property'],
      
      // Error handling
      [/\b(err|ok|try!|asserts!)\b/, 'builtin'],
      
      // Post conditions
      [/\b(post-condition-mode|post-condition-map-get|post-condition-eq)\b/, 'builtin']
    ]
  }
};

// Add code folding support
const foldingSupport = {
  fold: (state: any) => {
    const line = state.line.text;
    for (const range of foldingRanges) {
      if (range.start.test(line)) {
        return {
          from: state.pos,
          to: findEndOfSection(state, range.end)
        };
      }
    }
    return null;
  }
};

// Add intelligent code completion
const completionSupport = {
  complete: (context: CompletionContext) => {
    const word = context.matchBefore(/[\w-]+/);
    if (!word) return null;

    const line = context.state.doc.lineAt(context.pos);
    const lineStart = line.from;
    const lineText = line.text;

    const completions = [];
    
    // Handle different contexts
    if (lineText.trim().startsWith(';;')) {
      // Section headers
      completions.push(
        ...['traits', 'token definitions', 'constants', 'data vars', 'data maps', 
            'public functions', 'read only functions', 'private functions']
          .map(section => ({
            label: `${section}`,
            type: 'keyword',
            detail: 'Section header',
            boost: 99
          }))
      );
    } else {
      // Add define completions with full templates
      if (word.text.startsWith('def') || word.text.startsWith('define')) {
        completions.push(
          {
            label: 'define-read-only',
            type: 'keyword',
            detail: 'Define read-only function',
            apply: (view: any, completion: any, from: number, to: number) => {
              view.dispatch({
                changes: {
                  from,
                  to,
                  insert: '(define-read-only (function-name (param1 type1) (param2 type2))\n  true\n)'
                }
              });
            }
          },
          {
            label: 'define-public',
            type: 'keyword',
            detail: 'Define public function',
            apply: (view: any, completion: any, from: number, to: number) => {
              view.dispatch({
                changes: {
                  from,
                  to,
                  insert: '(define-public (function-name (param1 type1) (param2 type2))\n  (ok true)\n)'
                }
              });
            }
          },
          {
            label: 'define-private',
            type: 'keyword',
            detail: 'Define private function',
            apply: (view: any, completion: any, from: number, to: number) => {
              view.dispatch({
                changes: {
                  from,
                  to,
                  insert: '(define-private (function-name (param1 type1) (param2 type2))\n  true\n)'
                }
              });
            }
          },
          {
            label: 'define-map',
            type: 'keyword',
            detail: 'Define data map',
            apply: (view: any, completion: any, from: number, to: number) => {
              view.dispatch({
                changes: {
                  from,
                  to,
                  insert: '(define-map map-name {\n  key1: type1,\n  key2: type2\n} {\n  val1: type1,\n  val2: type2\n})'
                }
              });
            }
          },
          {
            label: 'define-data-var',
            type: 'keyword',
            detail: 'Define data variable',
            apply: (view: any, completion: any, from: number, to: number) => {
              view.dispatch({
                changes: {
                  from,
                  to,
                  insert: '(define-data-var var-name type initial-value)'
                }
              });
            }
          },
          {
            label: 'define-constant',
            type: 'keyword',
            detail: 'Define constant',
            apply: (view: any, completion: any, from: number, to: number) => {
              view.dispatch({
                changes: {
                  from,
                  to,
                  insert: '(define-constant constant-name value)'
                }
              });
            }
          },
          {
            label: 'define-fungible-token',
            type: 'keyword',
            detail: 'Define fungible token',
            apply: (view: any, completion: any, from: number, to: number) => {
              view.dispatch({
                changes: {
                  from,
                  to,
                  insert: '(define-fungible-token token-name u1000000)'
                }
              });
            }
          },
          {
            label: 'define-non-fungible-token',
            type: 'keyword',
            detail: 'Define non-fungible token',
            apply: (view: any, completion: any, from: number, to: number) => {
              view.dispatch({
                changes: {
                  from,
                  to,
                  insert: '(define-non-fungible-token token-name {\n  token-id: uint,\n  token-uri: (string-ascii 256)\n})'
                }
              });
            }
          }
        );
      }

      // Add control flow completions
      if (word.text.startsWith('let') || word.text.startsWith('begin') || word.text.startsWith('if')) {
        completions.push(
          {
            label: 'let',
            type: 'keyword',
            detail: 'Let binding',
            apply: (view: any, completion: any, from: number, to: number) => {
              view.dispatch({
                changes: {
                  from,
                  to,
                  insert: '(let (\n  (var1 value1)\n  (var2 value2)\n) expr)'
                }
              });
            }
          },
          // Add more control flow completions...
        );
      }

      // Add built-in function completions
      completions.push(
        ...builtinFunctions.map(f => ({
          label: f,
          type: 'function',
          detail: 'Built-in function'
        }))
      );

      // Add type completions
      completions.push(
        ...typeSignatures.map(t => ({
          label: t,
          type: 'type',
          detail: 'Type'
        }))
      );
    }

    return {
      from: word.from,
      options: completions,
      span: /^[\w-]*$/
    };
  }
};

const parser: StreamParser<unknown> = {
  name: 'clarity',
  
  token(stream: StringStream, state: unknown): string | null {
    if (stream.eatSpace()) return null;
    
    // Comments
    if (stream.match(/;.*/)) return "comment";
    
    // Section headers
    if (stream.match(/^;; (traits|token definitions|constants|data vars|data maps|public functions|read only functions|private functions)/)) 
      return "keyword";
    
    // Keywords
    if (stream.match(/(define-[a-z-]+)/)) return "keyword";
    
    // Built-in functions
    if (stream.match(/\b(map-get\?|map-set|map-delete|var-get|var-set|ok|err|some|none|try!|unwrap!|unwrap-err!|unwrap-panic|is-ok|is-err|is-some|is-none|ft-mint\?|ft-transfer\?|nft-mint\?|nft-transfer\?|stx-transfer\?|contract-call\?|as-contract|begin|let|match|asserts!)\b/))
      return "function";
    
    // Types
    if (stream.match(/\b(uint|int|bool|principal|buff|string-ascii|string-utf8|list|optional|response|tuple)\b/))
      return "type";
    
    // Numbers
    if (stream.match(/u?\d+/)) return "number";
    
    // Strings
    if (stream.match(/"[^"]*"/)) return "string";
    
    // Principals
    if (stream.match(/'[A-Z0-9]+/)) return "string";
    
    // Parentheses
    if (stream.match(/[()]/)) return "delimiter";
    
    // Special tokens
    if (stream.match(/\b(true|false|none)\b/)) return "atom";
    
    // Contract calls
    if (stream.match(/\.[a-zA-Z][a-zA-Z0-9_-]*/)) return "property";
    
    // Error handling
    if (stream.match(/\b(err|ok|try!|asserts!)\b/)) return "builtin";
    
    // Post conditions
    if (stream.match(/\b(post-condition-mode|post-condition-map-get|post-condition-eq)\b/))
      return "builtin";

    stream.next();
    return null;
  },

  startState() {
    return {};
  },

  copyState(state: unknown) {
    return state;
  }
};

const clarityCompletions = (context: CompletionContext): CompletionResult => {
  let word = context.matchBefore(/[\w-]+/);
  if (!word) {
    return {
      from: context.pos,
      to: context.pos,
      options: []
    };
  }

  const completions: CompletionOption[] = [];

  // Handle define statements first with higher boost
  if (word.text.startsWith('def') || word.text.startsWith('define')) {
    [
      {
        label: 'define-read-only',
        type: 'keyword',
        detail: 'Define read-only function',
        apply: (view: any, completion: any, from: number, to: number) => {
          view.dispatch({
            changes: {
              from,
              to,
              insert: '(define-read-only (function-name (param1 type1) (param2 type2))\n  true\n)'
            }
          });
        },
        boost: 100
      },
      {
        label: 'define-public',
        type: 'keyword',
        detail: 'Define public function',
        apply: (view: any, completion: any, from: number, to: number) => {
          view.dispatch({
            changes: {
              from,
              to,
              insert: '(define-public (function-name (param1 type1) (param2 type2))\n  (ok true)\n)'
            }
          });
        },
        boost: 100
      },
      {
        label: 'define-private',
        type: 'keyword',
        detail: 'Define private function',
        apply: (view: any, completion: any, from: number, to: number) => {
          view.dispatch({
            changes: {
              from,
              to,
              insert: '(define-private (function-name (param1 type1) (param2 type2))\n  true\n)'
            }
          });
        },
        boost: 100
      },
      {
        label: 'define-map',
        type: 'keyword',
        detail: 'Define data map',
        apply: (view: any, completion: any, from: number, to: number) => {
          view.dispatch({
            changes: {
              from,
              to,
              insert: '(define-map map-name {\n  key1: type1,\n  key2: type2\n} {\n  val1: type1,\n  val2: type2\n})'
            }
          });
        },
        boost: 100
      },
      {
        label: 'define-data-var',
        type: 'keyword',
        detail: 'Define data variable',
        apply: (view: any, completion: any, from: number, to: number) => {
          view.dispatch({
            changes: {
              from,
              to,
              insert: '(define-data-var var-name type initial-value)'
            }
          });
        },
        boost: 100
      },
      {
        label: 'define-constant',
        type: 'keyword',
        detail: 'Define constant',
        apply: (view: any, completion: any, from: number, to: number) => {
          view.dispatch({
            changes: {
              from,
              to,
              insert: '(define-constant constant-name value)'
            }
          });
        },
        boost: 100
      },
      // Add other define statements...
    ].forEach(completion => {
      if (completion.label.startsWith(word.text)) {
        completions.push(completion);
      }
    });
  }

  // Then handle built-in keywords and functions
  if (word.text) {
    // Add built-in keywords
    ['contract-caller', 'block-height', 'tx-sender'].forEach(keyword => {
      if (keyword.startsWith(word.text)) {
        completions.push({
          label: keyword,
          type: 'keyword',
          detail: `Built-in keyword: ${keyword}`,
          boost: 90
        });
      }
    });

    // Add other completions from templates
    Object.entries(templates).forEach(([key, template]) => {
      if (key.startsWith(word.text)) {
        completions.push({
          label: template.label,
          type: template.type,
          detail: template.detail,
          apply: template.apply,
          boost: 80
        });
      }
    });
  }

  return {
    from: word.from,
    to: word.to,
    options: completions,
    validFor: /^[\w-]*$/
  };
};
  
  const clarityLinter = linter((view) => {
    const diagnostics: Diagnostic[] = [];
    const text = view.state.doc.toString();
    
    // Helper to find position of a match in the document
    const findPosition = (searchText: string, startFrom: number = 0): { from: number, to: number } | null => {
      const pos = text.indexOf(searchText, startFrom);
      if (pos === -1) return null;
      return {
        from: pos,
        to: pos + searchText.length
      };
    };

    // Check each line for specific issues
    text.split('\n').forEach((line, lineIndex) => {
      const lineStart = text.split('\n').slice(0, lineIndex).join('\n').length + (lineIndex > 0 ? 1 : 0);
      
      // Skip comment-only lines and empty lines
      if (line.trim().startsWith(';;') || !line.trim()) return;

      // Check for map access without unwrapping
      if (line.includes('map-get?') && !line.includes('unwrap') && !line.includes('try!') && !line.includes('match')) {
        const pos = findPosition('map-get?', lineStart);
        if (pos) {
          diagnostics.push({
            from: pos.from,
            to: pos.to,
            severity: 'warning',
            message: 'Map access should handle none case using unwrap, try!, or match'
          });
        }
      }

      // Check for unbounded lists
      if (line.includes('(list ')) {
        const listMatch = line.match(/\(list\s+(?!\d+)/);
        if (listMatch) {
          const pos = findPosition(listMatch[0], lineStart);
          if (pos) {
            diagnostics.push({
              from: pos.from,
              to: pos.to,
              severity: 'error',
              message: 'Lists must have a specified maximum length'
            });
          }
        }
      }
    });

    // Check overall parentheses balance for the entire expression
    let balance = 0;
    let openParenPositions: number[] = [];
    let lastLineStart = 0;

    for (let i = 0; i < text.length; i++) {
      // Track line starts for error positioning
      if (text[i] === '\n') {
        lastLineStart = i + 1;
        continue;
      }

      // Skip comments
      if (text[i] === ';' && text[i + 1] === ';') {
        while (i < text.length && text[i] !== '\n') i++;
        continue;
      }

      if (text[i] === '(') {
        balance++;
        openParenPositions.push(i);
      } else if (text[i] === ')') {
        balance--;
        if (balance < 0) {
          // Extra closing parenthesis
          diagnostics.push({
            from: i,
            to: i + 1,
            severity: 'error',
            message: 'Unexpected closing parenthesis'
          });
        } else {
          openParenPositions.pop();
        }
      }
    }

    // If we have unclosed parentheses, mark the last unclosed one
    if (balance > 0 && openParenPositions.length > 0) {
      const lastOpenParen = openParenPositions[openParenPositions.length - 1];
      diagnostics.push({
        from: lastOpenParen,
        to: lastOpenParen + 1,
        severity: 'error',
        message: 'Missing closing parenthesis'
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