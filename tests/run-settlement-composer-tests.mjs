import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildPublicSettlementDraft,
  containsInternalSettlementGuidance,
} from "../libs/game/settlementComposer.mjs";

const leakedPreview = {
  authorityReason:
    "I am not willing to accept their response. I can authorize a completion-based counter with no refund, a total discount up to ₹10,000, clear specs, exact balance, firm one-week delivery, and a narrow delay remedy that caps risk.",
  suggestedRevision:
    "Send one concrete completion proposal only: no refund; revised total price and exact balance after a discount not exceeding ₹10,000; confirmed specifications from the message history; firm delivery date within one week; payment timing tied to delivery or inspection; and a limited remedy if delivery misses that date, such as cancellation with defined refund treatment or an additional capped discount, without admitting fault.",
  drivers: ["No refund still protected", "Need exact balance stated"],
};

const draft = buildPublicSettlementDraft({ clientPreview: leakedPreview });
assert.equal(
  draft,
  "My client is prepared to resolve this through completion of the order, not a refund. We propose a total discount of ₹10,000, with the revised contract price and exact remaining balance stated clearly in the final agreement. We will confirm the required specifications and commit to delivery within one week. Payment will be tied to delivery or inspection. If that deadline is missed, we can agree to a limited, capped delay remedy without any admission of fault. Please confirm whether your client will accept these terms so we can document the final arrangement."
);
assert.equal(containsInternalSettlementGuidance(draft), false);
assert.doesNotMatch(draft, /I can authorize|Send one concrete|Need exact|message history|Counteroffer:/i);

const aiDraft =
  "My client proposes payment within 14 days. Please confirm whether your client accepts.";
assert.equal(
  buildPublicSettlementDraft({ clientPreview: { outgoingDraft: aiDraft } }),
  aiDraft
);

assert.equal(
  buildPublicSettlementDraft({
    terms: [
      ["Settlement Amount", "$25,000"],
      ["Payment Timeline", "within 14 days"],
    ],
  }),
  "The proposed financial term is $25,000. The proposed timing is within 14 days. Please confirm which of these terms your client can accept."
);

const settlementSource = await readFile(
  new URL("../libs/game/settlement.js", import.meta.url),
  "utf8"
);
const workspaceSource = await readFile(
  new URL("../components/legal-arena/CaseWorkspace.js", import.meta.url),
  "utf8"
);
assert.match(settlementSource, /outgoingDraft/);
assert.match(settlementSource, /Do not copy authorityReason, suggestedRevision, drivers/);
assert.match(settlementSource, /concreteAuthorityRequested/);
assert.match(settlementSource, /directly choose and authorize reasonable negotiable terms/);
assert.match(settlementSource, /Never answer a request for concrete figures merely by saying to provide specifics/);
assert.match(settlementSource, /representedClientMemory/);
assert.match(workspaceSource, /buildPublicSettlementDraft/);
assert.match(workspaceSource, /mode: "assisted_follow_up"/);
assert.match(workspaceSource, /Confirm exact figures and delay remedy/);
assert.doesNotMatch(
  workspaceSource,
  /My client can continue settlement discussions within this range/
);

console.log("Settlement composer tests passed.");
