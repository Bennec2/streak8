# Game Phases (State Machine)

## Phases
| Phase          | Meaning                                                        |
|----------------|----------------------------------------------------------------|
| IDLE           | Before the first round; START HAND begins play                 |
| PLAYING        | Awaiting the player's guess                                    |
| GAMEOVER       | Wrong guess with no continue; red modal, new round auto-starts |
| VICTORY        | 8th card survived; gold trophy modal, jackpot credited         |
| CASHED_OUT     | Player banked a tier; emerald modal                            |
| CONTINUE_OFFER | Qualifier wrong guess with balance > $0; orange modal          |

## Transitions
- IDLE → PLAYING (startRound)
- PLAYING → PLAYING (correct guess, push, or accepted continue)
- PLAYING → CONTINUE_OFFER (wrong guess, qualifier, balance > $0)
- PLAYING → GAMEOVER (wrong guess otherwise)
- PLAYING → VICTORY (correct guess on the 8th card)
- PLAYING → CASHED_OUT (cash out)
- Terminal phases → PLAYING (auto after 2s, or immediately via modal buttons)

## Input gating
Guesses are ignored unless the phase is PLAYING and no card animation is in
flight. The wrong-guess flow plays a 2-second flip-and-fall animation before
the outcome modal appears; victory waits 1.5 seconds so the final card is seen
first.

## Open question
Should the 2-second auto-restart be skippable, or is the forced breather part
of the pacing?
