import type { Request, Response } from 'express';
import { roomService } from '../services/roomService.js';
import type { CreateRoomInput } from '../types/domain.js';

export const roomController = {
  create: (req: Request, res: Response) => {
    const room = roomService.createRoom(req.user!.userId, req.body as CreateRoomInput);
    res.status(201).json(room);
  },

  list: (req: Request, res: Response) => {
    const rooms = roomService.listRooms({
      gameType: req.query.gameType as 'coinche' | undefined,
      visibility: req.query.visibility as 'public' | 'private' | undefined,
      status: req.query.status as 'lobby' | 'in_progress' | 'completed' | undefined,
      page: req.query.page ? Number.parseInt(req.query.page as string, 10) : undefined,
      pageSize: req.query.pageSize ? Number.parseInt(req.query.pageSize as string, 10) : undefined,
    });
    res.json(rooms);
  },

  get: (req: Request, res: Response) => {
    const room = roomService.getRoom(req.params.roomId);
    res.json(room);
  },

  join: (req: Request, res: Response) => {
    const { seatIndex, asSpectator } = req.body as { seatIndex?: number; asSpectator?: boolean };
    const room = roomService.joinRoom(req.params.roomId, req.user!.userId, seatIndex, asSpectator);
    res.json(room);
  },

  leave: (req: Request, res: Response) => {
    const room = roomService.leaveRoom(req.params.roomId, req.user!.userId);
    res.json(room);
  },

  remove: (req: Request, res: Response) => {
    const room = roomService.removePlayer(req.params.roomId, req.user!.userId, req.params.playerId);
    res.json(room);
  },

  toggleReady: (req: Request, res: Response) => {
    const room = roomService.toggleReady(req.params.roomId, req.user!.userId, req.body.ready);
    res.json(room);
  },

  lock: (req: Request, res: Response) => {
    const room = roomService.lockRoom(req.params.roomId, req.user!.userId);
    res.json(room);
  },
  unlock: (req: Request, res: Response) => {
    const room = roomService.unlockRoom(req.params.roomId, req.user!.userId);
    res.json(room);
  },

  startGame: (req: Request, res: Response) => {
    const gameState = roomService.startGame(req.params.roomId, req.user!.userId);
    res.status(201).json(gameState);
  },

  fillWithBots: (req: Request, res: Response) => {
    const room = roomService.fillWithBots(req.params.roomId, req.user!.userId);
    res.json(room);
  },
};
