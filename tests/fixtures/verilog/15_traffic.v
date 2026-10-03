module traffic(input clk, rst, output reg [2:0] ns, ew);
  parameter GREEN = 3'b001, YELLOW = 3'b010, RED = 3'b100;
  reg [1:0] state; reg [3:0] timer;
  always @(posedge clk) begin
    if (rst) begin state <= 0; timer <= 0; end
    else if ((state[0] == 0 && timer == 7) || (state[0] == 1 && timer == 2)) begin state <= state + 1; timer <= 0; end
    else timer <= timer + 1;
  end
  always @* case (state)
    2'd0: begin ns = GREEN; ew = RED; end
    2'd1: begin ns = YELLOW; ew = RED; end
    2'd2: begin ns = RED; ew = GREEN; end
    default: begin ns = RED; ew = YELLOW; end
  endcase
endmodule
module tb;
  reg clk = 0, rst = 1; wire [2:0] ns, ew;
  traffic t(clk, rst, ns, ew);
  always #5 clk = ~clk;
  initial begin
    #12 rst = 0;
    $monitor("%0t state=%0d ns=%b ew=%b", $time, t.state, ns, ew);
    #250 $finish;
  end
endmodule
