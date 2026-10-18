// T-139: how Chatwoot v4.18.0 itself reads a rule, written down so the editor never guesses.
// Sources (read from the v4.18.0 tag): app/services/automation_rules/conditions_filter_service.rb (CFS),
// app/services/filter_service.rb (FS), app/services/filters/custom_attribute_filter_helper.rb (CAH),
// app/helpers/filters/filter_helper.rb (FH), lib/filters/filter_keys.yml, db/schema.rb, app/services/action_service.rb.
// The engine glues every condition into ONE SQL text ("a AND b OR c", CFS:30-36) and keeps a conversation only when
// that text is TRUE. SQL has three answers (true, false, empty/NULL), so "not equal to" is NOT the opposite of
// "equal to" when the column can be empty: both are NULL there and neither path runs. This file says, per field and
// operator, when an opposite is exact (negationOf), builds the SQL text the engine would build (toSql, checked
// against a real Postgres in the tests) and evaluates it the same way (evaluate) for the dry run.
import { attributeDefs, type Condition, type EventKey, type Rule, type Trigger } from "./catalog";

export const OPERATOR_KEYS: Record<string, string> = {
  "Equal to": "equal_to",
  "Not equal to": "not_equal_to",
  Contains: "contains",
  "Does not contain": "does_not_contain",
  "Is present": "is_present",
  "Is not present": "is_not_present",
  "Starts With": "starts_with",
  "Is greater than": "is_greater_than",
  "Is less than": "is_less_than",
  "Days before": "days_before",
};

type Store =
  | { table: "conversations"; column: string; json?: false; nullable: boolean }
  | { table: "conversations" | "contacts"; column: string; json: true; nullable: true }
  | { table: "contacts"; column: string; json?: false; nullable: true }
  | { table: "messages"; column: string; json?: false; nullable: boolean; lower?: true }
  | { table: "labels" }
  | { table: "custom"; model: "conversation_attribute" | "contact_attribute"; key: string };

/**
 * Where each field lives. CFS:63-77 looks a key up in conversations, then contacts, then messages (filter_keys.yml),
 * then custom attributes. `nullable` is from db/schema.rb: only status and inbox_id (conversations) and message_type
 * and private (messages) are `null: false`; JSON keys (`->>`) are empty whenever the key is missing.
 */
export function storeOf(attribute: string): Store | null {
  switch (attribute) {
    case "status":
      return { table: "conversations", column: "status", nullable: false };
    case "inbox_id":
      return { table: "conversations", column: "inbox_id", nullable: false };
    case "assignee_id":
    case "team_id":
    case "priority":
      return { table: "conversations", column: attribute, nullable: true };
    case "labels":
      return { table: "labels" };
    case "browser_language":
    case "conversation_language":
    case "referer":
    case "mail_subject":
      return { table: "conversations", column: attribute, json: true, nullable: true };
    case "email":
    case "phone_number":
      return { table: "contacts", column: attribute, nullable: true };
    case "country_code":
    case "city":
    case "company_name":
      return { table: "contacts", column: attribute, json: true, nullable: true };
    case "message_type":
      return { table: "messages", column: "message_type", nullable: false };
    case "private_note":
      return { table: "messages", column: "private", nullable: false };
    case "content":
      return { table: "messages", column: "processed_message_content", nullable: true, lower: true };
  }
  const custom = /^(conversation|contact)\.(.+)$/.exec(attribute);
  if (custom)
    return {
      table: "custom",
      model: custom[1] === "conversation" ? "conversation_attribute" : "contact_attribute",
      key: custom[2],
    };
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// Values: the text form keeps display names; Chatwoot keeps keys and ids. These maps are the preview's stand-in for
// the ids Chatwoot will hand out when Studio is linked (names are unique in the shared lists, so the map is 1:1).
const STATUS_KEYS: Record<string, string> = {
  Open: "open",
  Pending: "pending",
  Snoozed: "snoozed",
  Resolved: "resolved",
};
// Chatwoot's priority enum has no "none" (conversation.rb:87), so "None" becomes an empty value (FH:127-129).
const PRIORITY_KEYS: Record<string, string> = {
  None: "none",
  Low: "low",
  Medium: "medium",
  High: "high",
  Urgent: "urgent",
};
const MESSAGE_TYPE_KEYS: Record<string, string> = { "Incoming Message": "incoming", "Outgoing Message": "outgoing" };

const languageCode = (name: string) => /\(([^)]+)\)\s*$/.exec(name)?.[1] ?? name;
// Chatwoot stores ISO codes in contact.additional_attributes.country_code; the form lists country names.
const COUNTRY_CODES: Record<string, string> = {
  Qatar: "QA",
  "United Arab Emirates": "AE",
  "Saudi Arabia": "SA",
  Kuwait: "KW",
  Bahrain: "BH",
  Oman: "OM",
  India: "IN",
};
const countryCodeOf = (name: string) => COUNTRY_CODES[name] ?? name;

export type CwValue = string | number | boolean | null;

/** The value Chatwoot would receive for one display value of `attribute`. */
export function chatwootValue(attribute: string, value: string, ids: IdDirectory): CwValue {
  switch (attribute) {
    case "status":
      return STATUS_KEYS[value] ?? value.toLowerCase();
    case "priority":
      return PRIORITY_KEYS[value] ?? value.toLowerCase();
    case "message_type":
      return MESSAGE_TYPE_KEYS[value] ?? value;
    case "private_note":
      if (value === "True") return true;
      if (value === "False") return false;
      return value;
    case "inbox_id":
      return ids.inbox(value);
    case "assignee_id":
      return ids.agent(value);
    case "team_id":
      return ids.team(value);
    case "browser_language":
    case "conversation_language":
      return languageCode(value);
    case "country_code":
      return countryCodeOf(value);
    default:
      return value;
  }
}

/** Name -> id lookups used for the preview payload and the dry run. */
export interface IdDirectory {
  inbox(name: string): number | null;
  agent(name: string): number | null;
  team(name: string): number | null;
}

export function directory(lists: { inboxes: string[]; agents: string[]; teams: string[] }): IdDirectory {
  const by = (list: string[]) => (name: string) => {
    const index = list.indexOf(name);
    return index < 0 ? null : index + 1;
  };
  return { inbox: by(lists.inboxes), agent: by(lists.agents), team: by(lists.teams) };
}

export interface CwCondition {
  attribute_key: string;
  filter_operator: string;
  values: CwValue[];
  query_operator: "AND" | "OR" | null;
  custom_attribute_type: "" | "conversation_attribute" | "contact_attribute";
}

/** The text form's rows as Chatwoot stores them: the row's `join` moves to the row before it (automationHelper.js). */
export function toChatwootConditions(rows: Condition[], ids: IdDirectory): CwCondition[] {
  return rows.map((row, index) => {
    const store = storeOf(row.attribute);
    const custom = store?.table === "custom" ? store : null;
    const next = rows[index + 1];
    let queryOperator: CwCondition["query_operator"] = null;
    if (next) queryOperator = next.join === "or" ? "OR" : "AND";
    return {
      attribute_key: custom ? custom.key : row.attribute,
      filter_operator: OPERATOR_KEYS[row.operator] ?? row.operator,
      values: row.values.map((value) => chatwootValue(row.attribute, value, ids)),
      query_operator: queryOperator,
      custom_attribute_type: custom ? custom.model : "",
    };
  });
}

export interface CwRulePayload {
  name: string;
  description: string;
  event_name: EventKey;
  active: boolean;
  execution_delay: number | null;
  conditions: CwCondition[];
  actions: { action_name: string; action_params: unknown[] }[];
}

const MINUTES = { minutes: 1, hours: 60, days: 1440 } as const;

/** action_params as Chatwoot's form sends them (automationHelper.js): ids, "nil" for None, team email as one object. */
function actionParams(action: Rule["actions"][number], ids: IdDirectory): unknown[] {
  switch (action.action) {
    case "send_email_to_team":
      return [{ team_ids: action.values.map((team) => ids.team(team)), message: action.message ?? "" }];
    case "assign_team":
      return action.values.map((team) => (team === "None" ? "nil" : ids.team(team)));
    case "assign_agent":
      return action.values.map((agent) => {
        if (agent === "None") return "nil";
        if (agent === "Last Responding Agent") return "last_responding_agent";
        return ids.agent(agent);
      });
    default:
      return [...action.values];
  }
}

/** POST /api/v1/accounts/{id}/automation_rules body for one rule (automation_rules_controller.rb:67-68). */
export function toChatwootRule(rule: Rule, ids: IdDirectory): CwRulePayload {
  const delay = rule.runType === "delayed" && rule.wait ? rule.wait.amount * MINUTES[rule.wait.unit] : null;
  const own = toChatwootConditions(rule.conditions, ids);
  let conditions = own;
  if (rule.runType === "delayed" && rule.wait) {
    // AutomationWaitCondition.vue:280-310 + constants.js DELAYED_TRIGGERS: a wait is sent as preset conditions in
    // front of the others: message_type (outgoing also private_note = false) for the two "hasn't replied" waits, the
    // chosen status for the status wait, then inbox_id when inboxes are picked. A status wait takes no others.
    const preset = (attribute_key: string, values: CwValue[]): CwCondition => ({
      attribute_key,
      filter_operator: "equal_to",
      values,
      query_operator: "AND",
      custom_attribute_type: "",
    });
    const presets: Record<Trigger, () => CwCondition[]> = {
      conversation_status: () => [preset("status", [chatwootValue("status", rule.wait?.status ?? "", ids)])],
      customer_unresponsive: () => [preset("message_type", ["outgoing"]), preset("private_note", [false])],
      agent_unresponsive: () => [preset("message_type", ["incoming"])],
    };
    const wait = presets[rule.wait.trigger]();
    if (rule.wait.inboxes.length)
      wait.push(
        preset(
          "inbox_id",
          rule.wait.inboxes.map((inbox) => ids.inbox(inbox)),
        ),
      );
    const extra = rule.wait.trigger === "conversation_status" ? [] : own;
    const link = rule.conditions[0]?.join === "or" ? "OR" : "AND";
    wait[wait.length - 1].query_operator = extra.length ? link : null;
    conditions = [...wait, ...extra];
  }
  return {
    name: rule.name,
    description: rule.description,
    event_name: rule.event,
    active: rule.active,
    execution_delay: delay,
    conditions,
    actions: rule.actions.map((action) => ({ action_name: action.action, action_params: actionParams(action, ids) })),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// The SQL text. One entry per condition, in order, exactly as CFS/FS/CAH write it. `params[i]` is bound to :value_i.

type Bound = CwValue | CwValue[];

export interface SqlPiece {
  /** The condition's own SQL, without its AND/OR. */
  atom: string;
  /** CFS appends the row's query_operator after the atom. */
  op: "AND" | "OR" | null;
  /** CAH:59-65 adds " OR <attr> IS NULL " AFTER the operator for a custom "not equal to". */
  tailIsNull?: string;
}

const STATUS_ENUM: Record<string, number> = { open: 0, resolved: 1, pending: 2, snoozed: 3 };
const PRIORITY_ENUM: Record<string, number> = { low: 0, medium: 1, high: 2, urgent: 3 };
const MESSAGE_TYPE_ENUM: Record<string, number> = { incoming: 0, outgoing: 1, activity: 2, template: 3 };

function enumValues(values: CwValue[], table: Record<string, number>): (number | null)[] {
  // FH:121-133: values.map { |x| Enum[x.to_sym] } -> an unknown name becomes nil (SQL NULL).
  return values.map((value) => (typeof value === "string" && value in table ? table[value] : null));
}

/** Builds the WHERE text and its bound values for a list of Chatwoot conditions (one rule). */
export function toSql(conditions: CwCondition[]): { pieces: SqlPiece[]; params: Bound[]; sql: string } {
  const pieces: SqlPiece[] = [];
  const params: Bound[] = [];
  // FS:63-69 reads @custom_attribute_type, which CAH:2-4 sets on the first custom row and never clears: every row
  // after a custom one compares only its FIRST value, lowercased.
  let customTypeSet = false;
  conditions.forEach((condition, index) => {
    const op = condition.query_operator;
    const operator = condition.filter_operator;
    const key = condition.attribute_key;
    const ref = `:value_${index}`;
    const store =
      condition.custom_attribute_type !== ""
        ? storeOf(`${condition.custom_attribute_type === "conversation_attribute" ? "conversation" : "contact"}.${key}`)
        : storeOf(key);
    if (!store) {
      // CFS:63-77: a key it does not know adds nothing, not even its AND/OR.
      params.push(null);
      return;
    }
    if (store.table === "custom") customTypeSet = true;
    const caseInsensitiveValues = (): Bound =>
      customTypeSet && typeof condition.values[0] === "string"
        ? (condition.values[0] as string).toLowerCase()
        : condition.values;
    // FS:25-45 (+ CFS:54-61 for starts_with)
    const operation = (): string => {
      switch (operator) {
        case "equal_to":
        case "not_equal_to": {
          let bound: Bound;
          if (key === "status" && store.table === "conversations") bound = enumValues(condition.values, STATUS_ENUM);
          else if (key === "priority" && store.table === "conversations")
            bound = enumValues(condition.values, PRIORITY_ENUM);
          else if (key === "message_type" && store.table === "messages")
            bound = enumValues(condition.values, MESSAGE_TYPE_ENUM);
          else if (key === "content" && store.table === "messages")
            bound = condition.values.map((value) => (typeof value === "string" ? value.toLowerCase() : value));
          else bound = caseInsensitiveValues();
          params.push(bound);
          return operator === "equal_to" ? `IN (${ref})` : `NOT IN (${ref})`;
        }
        case "contains":
        case "does_not_contain":
          params.push(condition.values.map((value) => `%${String(value).trim()}%`));
          return operator === "contains" ? `ILIKE ANY (ARRAY[${ref}])` : `NOT ILIKE ALL (ARRAY[${ref}])`;
        case "starts_with":
          params.push(`${String(condition.values[0] ?? "").toLowerCase()}%`);
          return `LIKE ${ref}`;
        case "is_present":
          params.push("IS NOT NULL");
          return "IS NOT NULL";
        case "is_not_present":
          params.push("IS NULL");
          return "IS NULL";
        default:
          params.push(caseInsensitiveValues());
          return `= ${ref}`;
      }
    };
    switch (store.table) {
      case "labels": {
        // FS:128-149
        params.push(caseInsensitiveValues());
        const relation =
          "SELECT * FROM taggings WHERE taggings.taggable_id = conversations.id AND taggings.taggable_type = 'Conversation'";
        const tag = `AND taggings.tag_id IN (SELECT tags.id FROM tags WHERE tags.name IN (${ref}))`;
        const atoms: Record<string, string> = {
          equal_to: `EXISTS (${relation} ${tag})`,
          not_equal_to: `NOT EXISTS (${relation} ${tag})`,
          is_present: `EXISTS (${relation})`,
          is_not_present: `NOT EXISTS (${relation})`,
        };
        const atom = atoms[operator] ?? "";
        pieces.push({ atom, op });
        return;
      }
      case "conversations": {
        if (key === "assignee_id" && (operator === "is_present" || operator === "is_not_present")) {
          // FH:100-106
          params.push(null);
          pieces.push({
            atom:
              operator === "is_present"
                ? "(conversations.assignee_id IS NOT NULL OR conversations.assignee_agent_bot_id IS NOT NULL)"
                : "(conversations.assignee_id IS NULL AND conversations.assignee_agent_bot_id IS NULL)",
            op,
          });
          return;
        }
        const value = operation();
        const column = store.json
          ? `conversations.additional_attributes ->> '${store.column}'`
          : `conversations.${key}`;
        pieces.push({ atom: `${column} ${value}`, op });
        return;
      }
      case "contacts": {
        // CFS:131-143: no LOWER() here, even for the text_case_insensitive keys.
        const value = operation();
        const column = store.json ? `contacts.additional_attributes ->> '${store.column}'` : `contacts.${store.column}`;
        pieces.push({ atom: `${column} ${value}`, op });
        return;
      }
      case "messages": {
        // CFS:111-128
        const value = operation();
        const column = store.lower ? `LOWER(messages.${store.column})` : `messages.${store.column}`;
        pieces.push({ atom: `${column} ${value}`, op });
        return;
      }
      case "custom": {
        // CAH:22-39 (the preview's custom attributes are all text or list, both `text` in FS:9-11)
        const value = operation();
        const table = store.model === "conversation_attribute" ? "conversations" : "contacts";
        const expr = `(${table}.custom_attributes ->> '${store.key}')::text`;
        pieces.push({
          atom: `LOWER(${table}.custom_attributes ->> '${store.key}')::text ${value}`,
          op,
          tailIsNull: operator === "not_equal_to" ? `${expr} IS NULL` : undefined,
        });
        return;
      }
    }
  });
  const sql = pieces
    .map((piece) => ` ${piece.atom} ${piece.op ?? ""} ${piece.tailIsNull ? ` OR ${piece.tailIsNull} ` : ""}`)
    .join("");
  return { pieces, params, sql };
}

// ---------------------------------------------------------------------------------------------------------------
// Evaluating that SQL text on one conversation, with SQL's three answers. Used by the dry run; the tests check it
// against Postgres on the same rows.

export type Tri = true | false | null;

export interface SampleMessage {
  message_type: "incoming" | "outgoing" | "activity" | "template";
  private: boolean;
  content: string | null;
}

/** A conversation as the engine sees it (Chatwoot keys and ids, not display names). */
export interface SampleConversation {
  id: number;
  title: string;
  status: "open" | "resolved" | "pending" | "snoozed";
  inbox_id: number;
  assignee_id: number | null;
  assignee_agent_bot_id: number | null;
  team_id: number | null;
  priority: "low" | "medium" | "high" | "urgent" | null;
  labels: string[];
  additional_attributes: Record<string, string | null>;
  custom_attributes: Record<string, string | null>;
  contact: {
    email: string | null;
    phone_number: string | null;
    additional_attributes: Record<string, string | null>;
    custom_attributes: Record<string, string | null>;
  };
  messages: SampleMessage[];
}

function and3(values: Tri[]): Tri {
  if (values.includes(false)) return false;
  return values.includes(null) ? null : true;
}
function or3(values: Tri[]): Tri {
  if (values.includes(true)) return true;
  return values.includes(null) ? null : false;
}
const not3 = (value: Tri): Tri => (value === null ? null : !value);

function likeRegex(pattern: string, insensitive: boolean): RegExp {
  let source = "";
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === "\\" && i + 1 < pattern.length) source += pattern[++i].replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
    else if (ch === "%") source += "[\\s\\S]*";
    else if (ch === "_") source += "[\\s\\S]";
    else source += ch.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  }
  return new RegExp(`^${source}$`, insensitive ? "iu" : "u");
}

function inList(value: CwValue, list: CwValue[]): Tri {
  if (value === null) return null;
  if (list.some((item) => item !== null && item === value)) return true;
  return list.includes(null) ? null : false;
}

interface RowContext {
  conversation: SampleConversation;
  message: SampleMessage | null;
}

function columnValue(store: Store, ctx: RowContext): CwValue {
  const c = ctx.conversation;
  switch (store.table) {
    case "conversations":
      if (store.json) return c.additional_attributes[store.column] ?? null;
      if (store.column === "status") return STATUS_ENUM[c.status];
      if (store.column === "priority") return c.priority === null ? null : PRIORITY_ENUM[c.priority];
      return (c as unknown as Record<string, number | null>)[store.column] ?? null;
    case "contacts":
      if (store.json) return c.contact.additional_attributes[store.column] ?? null;
      return (c.contact as unknown as Record<string, string | null>)[store.column] ?? null;
    case "messages":
      if (!ctx.message) return null;
      if (store.column === "message_type") return MESSAGE_TYPE_ENUM[ctx.message.message_type];
      if (store.column === "private") return ctx.message.private;
      return ctx.message.content === null ? null : ctx.message.content.toLowerCase();
    case "custom": {
      const source = store.model === "conversation_attribute" ? c.custom_attributes : c.contact.custom_attributes;
      return source[store.key] ?? null;
    }
    default:
      return null;
  }
}

function atomValue(condition: CwCondition, bound: Bound, ctx: RowContext): Tri {
  const store =
    condition.custom_attribute_type !== ""
      ? storeOf(
          `${condition.custom_attribute_type === "conversation_attribute" ? "conversation" : "contact"}.${condition.attribute_key}`,
        )
      : storeOf(condition.attribute_key);
  if (!store) return true;
  const operator = condition.filter_operator;
  if (store.table === "labels") {
    const names = Array.isArray(bound) ? bound : [bound];
    const tagged = ctx.conversation.labels.some((label) => names.some((name) => name !== null && name === label));
    if (operator === "equal_to") return tagged;
    if (operator === "not_equal_to") return !tagged;
    if (operator === "is_present") return ctx.conversation.labels.length > 0;
    if (operator === "is_not_present") return ctx.conversation.labels.length === 0;
    return null;
  }
  if (store.table === "conversations" && condition.attribute_key === "assignee_id") {
    const assigned = ctx.conversation.assignee_id !== null || ctx.conversation.assignee_agent_bot_id !== null;
    if (operator === "is_present") return assigned;
    if (operator === "is_not_present") return !assigned;
  }
  let value = columnValue(store, ctx);
  if (store.table === "custom" && typeof value === "string") value = value.toLowerCase();
  // ActiveRecord binds an empty list as NULL ("IN (NULL)", "ARRAY[NULL]").
  let list: CwValue[] = [bound as CwValue];
  if (Array.isArray(bound)) list = bound.length ? bound : [null];
  switch (operator) {
    case "equal_to":
      return inList(value, list);
    case "not_equal_to":
      return not3(inList(value, list));
    case "contains":
    case "does_not_contain": {
      if (value === null) return null;
      const text = String(value);
      const hits: Tri[] = list.map((pattern) =>
        pattern === null ? null : likeRegex(String(pattern), true).test(text),
      );
      return operator === "contains" ? or3(hits) : and3(hits.map(not3));
    }
    case "starts_with":
      if (value === null || bound === null) return null;
      return likeRegex(String(bound), false).test(String(value));
    case "is_present":
      return value !== null;
    case "is_not_present":
      return value === null;
    default:
      return null;
  }
}

/**
 * TRUE when Chatwoot's ConditionsFilterService would find the conversation (records.any?, CFS:36-39). A broken SQL
 * text (two AND/OR in a row) raises in Postgres and CFS:40-43 rescues it as "no match".
 */
export function evaluate(
  conditions: CwCondition[],
  conversation: SampleConversation,
  event: EventKey,
  eventMessage?: SampleMessage,
): boolean {
  const { pieces, params } = toSql(conditions);
  if (!pieces.length) return true;
  // messages.private is boolean: a value that is not true/false makes Postgres raise ("invalid input syntax for
  // type boolean"), which CFS:40-43 rescues as no match.
  const badBoolean = conditions.some(
    (condition, index) =>
      condition.custom_attribute_type === "" &&
      condition.attribute_key === "private_note" &&
      (condition.filter_operator === "equal_to" || condition.filter_operator === "not_equal_to") &&
      [params[index]].flat().some((value) => value !== null && typeof value !== "boolean"),
  );
  if (badBoolean) return false;
  type Token = { kind: "atom"; eval: (ctx: RowContext) => Tri } | { kind: "op"; op: "AND" | "OR" };
  const tokens: Token[] = [];
  conditions.forEach((condition, index) => {
    const bound = params[index];
    const store =
      condition.custom_attribute_type !== ""
        ? storeOf(
            `${condition.custom_attribute_type === "conversation_attribute" ? "conversation" : "contact"}.${condition.attribute_key}`,
          )
        : storeOf(condition.attribute_key);
    if (!store) return;
    tokens.push({ kind: "atom", eval: (ctx) => atomValue(condition, bound, ctx) });
    if (condition.query_operator) tokens.push({ kind: "op", op: condition.query_operator });
    if (store.table === "custom" && condition.filter_operator === "not_equal_to") {
      tokens.push({ kind: "op", op: "OR" });
      tokens.push({
        kind: "atom",
        eval: (ctx) => {
          const source =
            store.model === "conversation_attribute"
              ? ctx.conversation.custom_attributes
              : ctx.conversation.contact.custom_attributes;
          return (source[store.key] ?? null) === null;
        },
      });
    }
  });
  // Grammar: atom (op atom)*. Anything else is a syntax error in Postgres -> rescued -> false.
  for (let i = 0; i < tokens.length; i++) if ((tokens[i].kind === "atom") !== (i % 2 === 0)) return false;
  if (tokens.length % 2 === 0) return false;
  let rows: RowContext[] = [{ conversation, message: null }];
  if (event === "message_created" && eventMessage) rows = [{ conversation, message: eventMessage }];
  else if (conversation.messages.length) rows = conversation.messages.map((message) => ({ conversation, message }));
  return rows.some((ctx) => {
    // AND binds tighter than OR (SQL precedence).
    const groups: Tri[][] = [[]];
    tokens.forEach((token) => {
      if (token.kind === "atom") groups[groups.length - 1].push(token.eval(ctx));
      else if (token.op === "OR") groups.push([]);
    });
    return or3(groups.map(and3)) === true;
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Exact opposites, for the Else path.

const OPPOSITE: Record<string, string> = {
  "Equal to": "Not equal to",
  "Not equal to": "Equal to",
  Contains: "Does not contain",
  "Does not contain": "Contains",
  "Is present": "Is not present",
  "Is not present": "Is present",
};

const labelOf = (attribute: string) => attributeDefs[attribute]?.label ?? attribute;

/**
 * The row that is TRUE exactly when `row` is not TRUE, for every conversation, or the reason there is none.
 * Exact means: both rows are never NULL (so SQL's third answer cannot hide a conversation from both paths).
 */
export function negationOf(row: Condition, event: EventKey): { row: Condition } | { reason: string } {
  const store = storeOf(row.attribute);
  const label = labelOf(row.attribute);
  const opposite = OPPOSITE[row.operator];
  if (!store) return { reason: `${label} is not a field the engine knows, so it has no opposite.` };
  if (store.table === "custom")
    return {
      reason: `${label} is a custom attribute. The engine writes these rows into its SQL differently: “Not equal to” gets “or empty” added after the row's AND/OR (which breaks the SQL when another row follows), and every row after a custom one compares only its first value, lowercased (custom_attribute_filter_helper.rb:59-65, filter_service.rb:63-69). Once rebuilt next to other rows, the two sides are no longer exact opposites.`,
    };
  if (row.operator === "Starts With")
    return { reason: `The engine has no “does not start with”, so “${label} starts with” has no opposite.` };
  if (!opposite)
    return {
      reason: `“${row.operator}” has no exact opposite: “greater than” and “less than” both miss a value equal to the limit and an empty one.`,
    };
  if (store.table === "messages" && event !== "message_created")
    return {
      reason: `${label} is a message field. Outside “Message Created” the engine checks every message of the conversation, so one message can match each side.`,
    };
  const presence = row.operator === "Is present" || row.operator === "Is not present";
  if (!presence) {
    if (!row.values.filter(Boolean).length) return { reason: `Add a value to ${label} first.` };
    const options = attributeDefs[row.attribute]?.options;
    if (store.table !== "labels") {
      if (store.nullable)
        return {
          reason: `${label} can be empty. The engine compares with SQL, where an empty value matches neither “${row.operator}” nor “${opposite}”, so a conversation without ${label.toLowerCase()} would run neither path.`,
        };
      const unknown = row.values.find((value) => !options?.includes(value));
      if (unknown !== undefined)
        return {
          reason: `“${unknown}” is not one of the ${label} options. The engine turns an unknown value into an empty one, which matches neither path.`,
        };
    }
  }
  return { row: { ...row, operator: opposite } };
}

// ---------------------------------------------------------------------------------------------------------------
// What each action changes that a condition can read (for two paths that become two rules). "*" = unknown: treat as
// changing everything. Sources: action_service.rb:9-82, automation_rules/action_service.rb:25-66,
// concerns/assignment_handler.rb:12-22 (a new team drops an agent who is not in it), message.rb:404-418 (only an
// INCOMING message reopens a conversation; automation messages are outgoing or private).
export const ACTION_WRITES: Record<string, string[]> = {
  assign_agent: ["assignee_id"],
  remove_assigned_agent: ["assignee_id"],
  assign_team: ["team_id", "assignee_id"],
  remove_assigned_team: ["team_id"],
  add_label: ["labels"],
  remove_label: ["labels"],
  change_priority: ["priority"],
  change_status: ["status"],
  open_conversation: ["status"],
  pending_conversation: ["status"],
  resolve_conversation: ["status"],
  snooze_conversation: ["status"],
  mute_conversation: ["status"],
  add_sla: ["sla_policy_id"],
  send_message: [],
  add_private_note: [],
  send_attachment: [],
  send_email_transcript: [],
  send_email_to_team: [],
  send_webhook_event: [],
  // M129-G: writes to the calendar (Davis), not to the conversation
  create_calendar_event: [],
  // F-11: write to Twenty, Bigcapital and the activity log, not to the conversation
  create_twenty_task: [],
  create_invoice_draft: [],
  notify_teammate: [],
};

export function writesOf(action: string): string[] {
  return ACTION_WRITES[action] ?? ["*"];
}

/** The field a condition row reads, in the same names as ACTION_WRITES. */
export function readOf(attribute: string): string {
  return attribute;
}
