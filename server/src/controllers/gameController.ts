import type { Request, Response } from 'express';
import { gameService } from '../services/gameService.js';

export const gameController = {
  getState: (req: Request, res: Response) => {
    const state = gameService.getGameState(req.params.gameId);
    res.json(state);
  },

  getStateSince: (req: Request, res: Response) => {
    const since = req.query.sinceVersion ? Number.parseInt(req.query.sinceVersion as string, 10) : undefined;
    const state = gameService.getGameStateSince(req.params.gameId, since);
    res.json(state);
  },

  getTurn: (req: Request, res: Response) => {
    const turn = gameService.getTurnMetadata(req.params.gameId);
    res.json(turn);
  },

  getPrivateHand: (req: Request, res: Response) => {
    const hand = gameService.getPrivateHand(req.params.gameId, req.user!.userId);
    res.json(hand);
  },

  submitMove: (req: Request, res: Response) => {
    const result = gameService.submitMove(req.params.gameId, {
      gameId: req.params.gameId,
      playerId: req.user!.userId,
      stateVersion: req.body.stateVersion,
      moveType: req.body.moveType,
      payload: req.body.payload,
      clientMoveId: req.body.clientMoveId,
    });
    res.json(result);
  },

  listEvents: (req: Request, res: Response) => {
    const events = gameService.listEvents(req.params.gameId, (req.query.after as string | undefined) ?? null);
    res.json(events);
  },

  invalidateMove: (req: Request, res: Response) => {
    gameService.invalidateMove(req.params.gameId, req.params.moveId);
    res.json({ ok: true });
  },

  // Bidding phase controllers
  submitBid: (req: Request, res: Response) => {
    const { contractType, value } = req.body;
    const result = gameService.submitBid(
      req.params.gameId,
      req.user!.userId,
      contractType,
      value,
    );
    res.json(result);
  },

  submitPass: (req: Request, res: Response) => {
    const result = gameService.submitPass(req.params.gameId, req.user!.userId);
    res.json(result);
  },

  submitCoinche: (req: Request, res: Response) => {
    const result = gameService.submitCoinche(req.params.gameId, req.user!.userId);
    res.json(result);
  },

  submitSurcoinche: (req: Request, res: Response) => {
    const result = gameService.submitSurcoinche(req.params.gameId, req.user!.userId);
    res.json(result);
  },
};
