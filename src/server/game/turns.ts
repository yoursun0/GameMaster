import type { SessionState } from './schemas';

export function markSeatVisited(state: SessionState, seat: number): SessionState {
  const next = structuredClone(state);
  if (!next.turn.visitedSeats.includes(seat)) {
    next.turn.visitedSeats.push(seat);
  }
  return next;
}

export function nextUnvisitedSeat(state: SessionState): number | null {
  const size = state.party.length;
  for (let seat = 0; seat < size; seat += 1) {
    if (!state.turn.visitedSeats.includes(seat)) {
      return seat;
    }
  }
  return null;
}

export function beginNextRound(state: SessionState): SessionState {
  const next = structuredClone(state);
  next.turn.activeSeat = 0;
  next.turn.round += 1;
  next.turn.visitedSeats = [];
  next.turn.meaningfulActionsThisRound = 0;
  return next;
}

export function resetAllPassRound(state: SessionState): SessionState {
  const next = structuredClone(state);
  next.turn.activeSeat = 0;
  next.turn.visitedSeats = [];
  next.turn.meaningfulActionsThisRound = 0;
  return next;
}
