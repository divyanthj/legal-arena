import Section1 from "./sections/Section1";
import Section2 from "./sections/Section2";
import Section3 from "./sections/Section3";

export default function HelpPage() {
  return (
    <div className="help-prose mx-auto px-4">
      <Section1 id="getting-started" />
      <Section2 id="building-your-file" />
      <Section3 id="courtroom-playbook" />
    </div>
  );
}
