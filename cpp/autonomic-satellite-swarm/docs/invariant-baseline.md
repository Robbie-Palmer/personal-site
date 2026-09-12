# Coordination invariant baseline

**Status:** Characterization of the temporary-leader controller, not a flight-software claim.

The deterministic checks in `tests/invariant_test.cpp` apply the fault model from the distributed
coordination research note. They separate a node's local evidence from facts it cannot infer over a
lossy or one-way link.

## What each node can claim

| Fault | Leader can claim | Candidate can claim | Neither can claim |
| --- | --- | --- | --- |
| Acknowledgement to the candidate is lost | It received the candidacy and handed an acknowledgement to its transport. It may later select and broadcast an assignment. | Before an assignment, it knows only that it sent candidacy and received no matching acknowledgement. A matching assignment is enough for this controller to become active. | That the acknowledgement arrived. The leader also cannot claim that the assignment arrived or that the candidate became active. |
| Assignment to the winner is lost | It selected a target and handed the assignment to its transport. Its `assigned_node` records selection only. Delivery remains unknown. | It received the request and acknowledgement but no assignment. It never becomes active and returns to idle after its wait expires. | That the selected target owns or started the mission. Another node seeing the broadcast cannot infer delivery to the target. |

The protocol has no assignment acknowledgement. Adding one would report another observation, but a
lost reply would still leave the leader uncertain whether the candidate acted.

## Executable results

| Invariant | Baseline | Deterministic evidence |
| --- | --- | --- |
| A safe-disabled node cannot become active before reset. | Pass | A fatal-health transition followed by a duplicated assignment stays safe-disabled. |
| An active node has a valid assignment for the mission key it holds. | Pass in the scripted scenarios | Loss, duplication, and one-way-link runs check every active frame for a valid key and self-assignment. |
| At most one node is active for one mission key. | Pass in the scripted scenarios | The same runs compare active nodes in every frame. These regression cases do not cover all schedules. |
| An expired request cannot start work. | **Fail** | A request delayed past the leader's response window still moves an idle candidate to `awaiting acknowledgement`; the message carries no deadline. |
| A duplicated message cannot repeat an accepted software transition. | Pass for assignment duplication | Delivering the same assignment twice produces one transition to active. This says nothing about an external actuator. |
| Link loss cannot block local fatal-health handling. | Pass | A node with both directions disconnected still enters safe-disabled from its local health input. |
| Safe-disabled survives a node reset until explicit recovery. | **Fail** | Reset replaces the controller and moves the node from safe-disabled to idle. The simulator records the new boot epoch, but no safe-state latch is durable. |

Stable mission keys fix one narrower failure. Missions from different origin nodes no longer alias,
and a leader reset changes `{origin, epoch, sequence}` even when its sequence restarts at one. The
controller rejects an acknowledgement or assignment whose full key belongs to an earlier leader
boot.

The keys do not fix the two baseline failures above. Command deadlines and durable safe-state
recovery need separate protocol and persistence decisions.
