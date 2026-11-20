import PolicyPage from "@/components/PolicyPage";

export const metadata = { title: "Privacy policy | AIMosaic" };

export default function Privacy() {
  return (
    <PolicyPage title="Privacy policy">
      <p>This policy explains what AIMosaic collects, why, and who receives it.</p>
      <h2>What we collect</h2>
      <ul>
        <li><strong>Account details:</strong> your email address and a hashed (unreadable) version of your password.</li>
        <li><strong>Your chats:</strong> the messages you send and the replies you receive, so you can reopen them.</li>
        <li><strong>Usage records:</strong> which model answered, how many tokens were used and what it cost.</li>
        <li><strong>Technical data:</strong> your IP address, used to limit abuse, and one sign-in cookie.</li>
      </ul>
      <h2>Who receives your messages</h2>
      <p>
        To get an answer, your message is sent to the AI model you choose, through our model gateway provider
        and on to the company that runs that model. Those companies process the message under their own terms.
        Do not include information you are not permitted to share with them.
      </p>
      <h2>What we do not do</h2>
      <ul>
        <li>We do not use your chats to train AI models.</li>
        <li>We do not sell your personal data.</li>
        <li>We do not use advertising trackers.</li>
      </ul>
      <h2>Keeping and deleting</h2>
      <p>
        Chats stay in your account until you delete them; deleting a chat removes it from our database. To
        close your account and delete all your data, contact us. [Contact email to be added.]
      </p>
      <h2>Your rights</h2>
      <p>
        Depending on where you live, you may have rights to access, correct, export or delete your data.
        [Jurisdiction-specific wording, including India&apos;s DPDP Act and the GDPR, to be added by counsel.]
      </p>
      <h2>Who we are</h2>
      <p>[Legal entity name, registered address and contact details to be added.]</p>
    </PolicyPage>
  );
}
