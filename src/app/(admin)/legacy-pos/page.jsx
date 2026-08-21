// TEMPORARY: the old POS migration desk. Removed with the rest of the bridge —
// see postgressserver/src/legacy-pos/README.md.
import LegacyPosMigration from 'src/components/_admin/legacyPos/LegacyPosMigration';

export default function LegacyPosPage() {
  return <LegacyPosMigration />;
}
