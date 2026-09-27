import AttributesManager from 'src/components/_admin/attributes/AttributesManager';

// The create link lands on the same screen, with the new-attribute panel open.
export default function CreateAttributePage() {
  return <AttributesManager startCreating />;
}
