import { HomePerspectiveSet } from '../generated/UprtclHomePerspective/UprtclHomePerspective'
import { HomePerspective } from '../generated/schema'

export function handleHomePerspectiveSet(event: HomePerspectiveSet): void {
  let homePerspective = new HomePerspective();
  homePerspective.owner = event.params.owner;
  homePerspective.perspectiveId = event.params.perspectiveId;
  homePerspective.save();
}