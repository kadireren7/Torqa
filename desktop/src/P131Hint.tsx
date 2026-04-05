import type { Translate } from "./i18n";

type Props = {
  t: Translate;
  text: string;
  onDismiss: () => void;
};

/** P131: single-line dismissible hint — no modal, no tour. */
export function P131Hint({ t, text, onDismiss }: Props) {
  return (
    <div className="p131-hint" role="note">
      <p className="p131-hint-text">{text}</p>
      <button type="button" className="p131-hint-dismiss" onClick={onDismiss} aria-label={t("p131.dismiss.aria")}>
        {t("p131.dismiss")}
      </button>
    </div>
  );
}
