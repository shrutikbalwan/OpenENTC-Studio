module seqdet(input clk, rst, x, output reg y);
  localparam S0 = 2'd0, S1 = 2'd1, S2 = 2'd2, S3 = 2'd3;
  reg [1:0] state, next;
  always @(posedge clk) if (rst) state <= S0; else state <= next;
  always @(*) begin
    next = state; y = 0;
    case (state)
      S0: next = x ? S1 : S0;
      S1: next = x ? S1 : S2;
      S2: next = x ? S3 : S0;
      S3: begin y = 1; next = x ? S1 : S2; end
      default: next = S0;
    endcase
  end
endmodule
module tb;
  reg clk = 0, rst = 1, x = 0; wire y;
  seqdet d(clk, rst, x, y);
  always #5 clk = ~clk;
  reg [15:0] pattern = 16'b1011_0101_1010_1101;
  integer k;
  initial begin
    @(negedge clk) rst = 0;
    for (k = 15; k >= 0; k = k - 1) begin x = pattern[k]; @(negedge clk) $display("t=%0t x=%b state=%d y=%b", $time, x, d.state, y); end
    $finish;
  end
endmodule
