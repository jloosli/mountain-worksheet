import { render, screen } from "../../test-utils/test-utils";
import AppContainer from "../AppContainer";

describe("AppContainer", () => {
  it("renders without crashing", () => {
    render(<AppContainer />);
    expect(screen.getByText("Mountain Flying Worksheet")).toBeInTheDocument();
  });
});
