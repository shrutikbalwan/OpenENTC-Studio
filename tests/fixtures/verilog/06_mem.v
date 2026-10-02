module ram(input clk, we, input [3:0] addr, input [7:0] din, output [7:0] dout);
  reg [7:0] mem [0:15];
  always @(posedge clk) if (we) mem[addr] <= din;
  assign dout = mem[addr];
endmodule
module tb;
  reg clk = 0, we = 0; reg [3:0] addr = 0; reg [7:0] din = 0; wire [7:0] dout;
  ram r(clk, we, addr, din, dout);
  always #1 clk = ~clk;
  integer k;
  initial begin
    for (k = 0; k < 16; k = k + 1) begin @(negedge clk); we = 1; addr = k; din = k * 7 + 3; end
    @(negedge clk) we = 0;
    for (k = 0; k < 16; k = k + 4) begin addr = k; #2 $display("mem[%0d] = %d (%h)", addr, dout, dout); end
    $finish;
  end
endmodule
