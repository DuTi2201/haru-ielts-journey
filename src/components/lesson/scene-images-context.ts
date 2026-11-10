import { createContext } from "react";

/** image prompt -> URL of a generated picture. Empty unless the server has scene
 * pictures switched on; every scene is drawn from icons either way. */
export const SceneImagesContext = createContext<Record<string, string>>({});
