import type { SqlDb } from './types';
import { createSeries, deleteSeries } from './seed';
import { listSeries, getSeries, updateSeries } from './series';
import { listBooks, addBook, updateBook, moveBook, deleteBook } from './books';
import { listTypes, createType, updateType, deleteType } from './entityTypes';
import {
  createEntity, updateEntity, deleteEntity, getEntity, listEntities, searchEntities, backlinks,
} from './entities';
import { getEventDetail, saveEvent, addParticipant, updateParticipantRole, removeParticipant, eventsForEntity } from './events';
import { listAges, createAge, updateAge, deleteAge, listBuckets, updateBucket } from './calendar';

/** Every domain function the UI may call through the worker. Each takes the db first. */
export const api = {
  createSeries, deleteSeries, listSeries, getSeries, updateSeries,
  listBooks, addBook, updateBook, moveBook, deleteBook,
  listTypes, createType, updateType, deleteType,
  createEntity, updateEntity, deleteEntity, getEntity, listEntities, searchEntities, backlinks,
  getEventDetail, saveEvent, addParticipant, updateParticipantRole, removeParticipant, eventsForEntity,
  listAges, createAge, updateAge, deleteAge, listBuckets, updateBucket,
};

export type Api = typeof api;
export type ApiName = keyof Api;
type Rest<F> = F extends (db: SqlDb, ...args: infer A) => unknown ? A : never;
export type ApiArgs<K extends ApiName> = Rest<Api[K]>;
export type ApiResult<K extends ApiName> = ReturnType<Api[K]>;
