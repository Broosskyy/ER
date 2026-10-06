import { bindEventRepository } from '@/core/bootstrap/app-bootstrap';
import { EventRepository } from '@/data/repositories/repositories';
import {
  AsyncStorageFollowStorage,
  FollowService,
  InMemoryFollowStorage,
} from '@/features/follows/follow-service';
import { isWebRuntime } from '@/platform/runtime-platform';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const eventRepository = new EventRepository();

bindEventRepository(eventRepository);

const followStorage = isWebRuntime()
  ? new InMemoryFollowStorage()
  : new AsyncStorageFollowStorage(AsyncStorage);

export const followService = new FollowService({ storage: followStorage });
