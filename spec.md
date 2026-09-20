# MVP Specification — AI Game Master Text RPG

## 1. Product concept

A browser-based, story-driven RPG for **1–4 players sharing one browser**. DeepSeek acts as the Game Master (GM), describing the world, portraying supporting characters, introducing events, and adapting the story to players’ decisions.

Players choose a setting and characters, then take turns responding through chat. A simple rules engine manages attributes, checks, resources, and consequences.

**Core experience:** Read the situation → choose who acts → type an action → see the outcome → continue the story.

The game supports **English and Traditional Chinese**, (user choose a language at the beginning), including interface text, character descriptions, and GM narration.

## 2. MVP scope

| Area | MVP requirement |
| --- | --- |
| Play mode | Local shared-screen play with 1–4 players |
| Game Master | DeepSeek-powered narration and action interpretation |
| Settings | Four original fictional worlds, language choice (Traditional Chinese or English) |
| Characters | Four predefined characters per setting |
| Input | Free-text actions, with optional suggested actions |
| Rules | Simple attribute checks, HP, MP, conditions, and party inventory |
| Adventure length | Approximately 30–60 minutes; target 8–12 scenes |
| Progress | Automatic saving and resuming in the same browser |
| Endings | A clear conclusion reflecting major decisions |
| Accounts | Not required |

“Local play” means players share a device. **An internet connection is required for the AI Game Master.**

## 3. Starting a game

1. **Choose language:** English or 繁體中文.
2. **Choose a world:** See its premise, tone, and example opening.
3. **Choose player count:** 1–4.
4. **Assign characters:** Each player enters a display name and selects a different character.
5. **Review the party:** Show roles and explain the rules in a short panel.
6. **Begin:** The GM introduces the party, immediate problem, and first decision.

Use defaults wherever possible. No character creation questionnaire, account setup, or long tutorial.

**Target:** Players can begin an adventure within three minutes.

## 4. Worlds and characters

All settings, names, and stories are original. The referenced works establish tone rather than supplying licensed characters or locations.

| World | Premise and tone | Four selectable characters |
| --- | --- | --- |
| **Ashen Thrones / 權鬥王座** | Rival houses struggle over a dying kingdom as ancient dragons awaken. Political intrigue, dangerous journeys, and uncertain loyalties. | Exiled knight, dragon scholar, court envoy, border scout |
| **Aetherfall / 魔導幻想** | An industrial city runs on extracted magical energy. Rebels uncover the human cost behind its prosperity. | Augmented guardian, aether engineer, underground medic, rebel courier |
| **Glass Hearts / 玻璃校園** | Rumours, concealed relationships, and conflicting loyalties threaten a university social circle. Psychological drama and dark romance; all characters are adults. | Student representative, reserved artist, charismatic club organiser, investigative student reporter |
| **Cyberpunk Dawn/ 駭客黎明** | People living in a controlled artificial reality discover evidence that their world is being manipulated by an AI regime. | Awakened enforcer, systems hacker, resistance negotiator, reality runner |

Each character has:

- A short biography and personal motivation.
- One connection to another character or the opening mystery.
- Fixed starting attributes and resources.
- One signature ability.
- One starting item.

Personal motivations add role-playing opportunities but do not require player-versus-player conflict. All gameplay and character information are visible on the shared screen.

### Opening structure

Each setting ships with an authored scenario containing:

- An immediate problem.
- A shared party objective.
- Three important supporting characters.
- Several locations and possible complications.
- A central secret.
- Possible success, compromise, and failure endings.

DeepSeek adapts the route through this scenario. The authored material keeps the opening coherent and gives the adventure a destination.

## 5. Character rules

### Attributes

| Attribute | Used for |
| --- | --- |
| **Might / 力量** | Physical effort, direct confrontation, endurance |
| **Agility / 敏捷** | Movement, stealth, precision |
| **Insight / 洞察** | Investigation, technical work, magic, perception |
| **Presence / 魅力** | Persuasion, deception, leadership, composure |

Attributes range from **1–4**.

Four reusable mechanical profiles reduce balancing work. Characters within each world receive different biographies and abilities.

| Profile | HP | MP | Might | Agility | Insight | Presence |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Guardian | 14 | 4 | 4 | 2 | 1 | 3 |
| Specialist | 10 | 8 | 1 | 2 | 4 | 3 |
| Mediator | 12 | 6 | 2 | 1 | 3 | 4 |
| Scout | 11 | 6 | 2 | 4 | 3 | 1 |

### Resources and abilities

- **HP:** Ability to keep participating under pressure.
- **MP:** Resource used for signature abilities.
- **Signature ability:** Costs 2 MP and grants +3 to one relevant check. Each ability has explicit usage conditions.
- Resources carry between scenes. Recovery requires a defined rest opportunity or consumable.
- No levels, experience points, or equipment optimisation in the MVP.

World-specific labels preserve the same underlying rules:

| Setting | HP presentation | MP presentation |
| --- | --- | --- |
| Fantasy | Vitality | Mana |
| Machine and magic | Vitality | Aether |
| University drama | Composure | Resolve |
| AI future | Integrity | Focus |

The interface can retain the HP/MP abbreviations beside these labels. Consequences must fit the setting: social drama uses embarrassment, stress, and damaged relationships rather than treating conversations as physical combat.

### Reaching zero HP

A character becomes **Overwhelmed** and cannot perform risky actions until helped or the scene ends. They may still speak and participate in decisions.

If the entire party becomes overwhelmed, the GM introduces a setback—capture, exposure, loss of an opportunity—and advances the story. Players should not become stuck or be permanently excluded from a shared session.

## 6. Gameplay loop and turns

The adventure follows three broad stages:

1. **Introduction:** Establish the problem and stakes.
2. **Escalation:** Investigate, negotiate, overcome obstacles, and make consequential choices.
3. **Climax and ending:** Resolve the central problem and show the consequences.

A **scene** is a location or dramatic situation. An **event** is an actionable problem inside that scene.

### Event flow

1. The GM describes what happened and what is at stake.
2. The interface identifies the active player.
3. That player types one action or selects and edits a suggestion.
4. The system resolves the action.
5. The GM narrates the consequence and updates the situation.
6. The next player acts, or the story advances.

### Turn rules

- Only one player submits an action at a time.
- Default order follows party order, with every eligible player receiving a turn before another round begins.
- An event may target a particular character, but control returns to the normal order afterward.
- Players may pass without penalty.
- Each submission represents **one meaningful action**.
- A player controls only their own character. Proposed actions for teammates require those players’ own turns.
- Brief clarification questions do not consume a turn or resources.

Each prompt provides **2–3 suggested actions** plus free-text input. Suggestions help beginners but do not restrict valid alternatives.

## 7. Action resolution

The game uses lightweight checks rather than implementing the full Dungeons & Dragons rules.

### Checks

When an action is uncertain and has meaningful consequences:

**Result = d20 + relevant attribute + applicable modifier**

| Difficulty | Target |
| --- | ---: |
| Easy | 8 |
| Standard | 12 |
| Hard | 16 |

- **Success:** Meets or exceeds the target.
- **Partial success:** Falls short by 1–3; succeeds with a cost or complication.
- **Failure:** Falls short by 4 or more; introduces a consequence or changes the situation.

Routine actions succeed without a roll. Impossible actions receive a short explanation and feasible alternatives without consuming a turn.

The interface shows the result clearly:

> Agility check: 11 + 4 = 15 against 12 — Success.

### Consequences

Consequences use a bounded set of supported changes:

- Lose or recover HP/MP.
- Gain or remove an item.
- Apply or remove a condition.
- Change a supporting character’s trust.
- Advance a threat or objective.
- Reveal information or open a route.

Conditions are limited to a small predefined list with explicit effects and expiry. The GM cannot invent permanent numerical modifiers.

Failure must move the story forward. Repeating a failed action without changing the approach does not produce unlimited rerolls.

### Conflict

Combat, pursuit, arguments, and hacking use the same event-and-check system.

There is no tactical grid, positioning system, or separate combat interface. Challenge intensity scales with party size, and no scenario requires a specific character to be present.

## 8. Game Master behaviour

The GM must:

- Maintain the chosen language and setting.
- Give players an immediate, understandable situation.
- Describe stakes before consequential decisions.
- Respond meaningfully to unexpected but plausible actions.
- Preserve established facts and character identities.
- Let players decide their own dialogue, intentions, and major choices.
- Distribute attention across the party.
- Bring the adventure toward a conclusion.

Default narration is approximately **80–150 English words or 150–300 Traditional Chinese characters** per response, with shorter responses for simple actions.

Player instructions cannot override game rules, reveal hidden scenario information, or directly alter statistics.

### Division of responsibility

| DeepSeek GM | Application rules engine |
| --- | --- |
| Interpret player intent | Validate the active player and action |
| Propose the relevant check | Enforce allowed attributes and difficulty |
| Portray characters and describe outcomes | Roll dice and determine success |
| Propose story developments | Validate and apply state changes |
| Maintain narrative continuity | Store authoritative character and session state |

**The model proposes; the application validates and commits.** Narrative text alone never changes game state.

## 9. Interface

### Main game screen

- **Story feed:** GM narration, player actions, and compact check results.
- **Party panel:** Characters, HP/MP, conditions, and active-player indicator.
- **Action composer:** Player name, text input, suggestions, signature ability, and pass.
- **Objective panel:** Current goal and brief scene summary.
- **Session controls:** Rules reference, save status, language, and end session.

On mobile, party details and the objective panel collapse into drawers.

GM narration and player messages must be visually distinct. Loading states clearly indicate that the GM is responding and prevent duplicate submissions.

### Ending screen

Show:

- The adventure’s outcome.
- Major decisions and their consequences.
- A short epilogue for each character.
- Options to restart or choose another setting.

## 10. Saving, continuity, and reliability

- Automatically save after every completed action.
- Support one active adventure per browser in the MVP.
- Reloading resumes the latest committed state.
- Starting a new adventure requires confirmation before replacing the active save.
- Store the transcript, character state, inventory, objectives, story flags, turn order, and narrative summary.
- Keep hidden scenario information on the server.

For each GM request, provide the setting rules, scenario, authoritative state, continuity summary, and recent messages. Important facts must live in structured state rather than relying only on chat history.

If a request fails:

- Keep the player’s submitted action.
- Show a retry option.
- Preserve any already-generated roll.
- Avoid duplicate resource deductions or story events.

An interrupted response must never leave a partially applied turn.

## 11. Technical outline

**Proposed stack:** TypeScript, React/Next.js, a server-side DeepSeek integration, and SQLite for the initial single-instance deployment.

- The browser handles presentation and input.
- Server endpoints handle sessions, turn validation, rules, and AI requests.
- DeepSeek credentials remain on the server and are never included in browser code.
- A random session credential stored in the browser identifies the local party without user accounts.
- Model choice and generation settings are server configuration.

### Action-processing sequence

1. Validate the submitted session, player, and turn.
2. Ask DeepSeek to interpret the action into a structured proposal.
3. Validate the proposal and resolve any check.
4. Ask DeepSeek to narrate the fixed outcome and propose supported story updates.
5. Validate updates and atomically save the completed turn.
6. Return narration and updated state to the browser.

Use structured response validation, request timeouts, bounded retries, submission identifiers, and per-session rate limits. Client-visible responses exclude hidden GM information.

## 12. Out of scope

- Online multiplayer or separate player devices.
- Accounts, matchmaking, payments, or cloud-save synchronisation.
- Custom worlds or custom character creation.
- Full D&D rules, tactical combat, or extensive inventories.
- Long campaigns, levelling, or procedural skill trees.
- Images, voice narration, animations, and music generation.
- Private messages, hidden player objectives, and player-versus-player combat.
- Offline AI execution.

## 13. Acceptance criteria

The MVP is ready when:

1. A new party can start any setting with 1–4 characters in either language.
2. Every setting has a complete opening, achievable objective, and reachable ending.
3. Players can use suggestions or free-text actions throughout an adventure.
4. Risky actions produce visible, reproducible check results and valid consequences.
5. HP, MP, inventory, conditions, and turn order stay consistent with saved state.
6. Every selected character remains able to participate, including after setbacks.
7. Refreshing the browser restores the latest completed turn.
8. Duplicate submissions and retries never apply an action twice.
9. Invalid AI output cannot corrupt the session or bypass rules.
10. Each setting completes a smoke-test adventure in both languages; additional runs verify solo and four-player pacing.
11. The interface is usable on desktop and mobile.
12. No provider credentials or hidden scenario secrets appear in browser responses.

**Primary playtest measure:** A first-time party can finish a short adventure without a facilitator explaining the interface, and players can identify at least one decision that changed its outcome.
