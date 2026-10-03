module updown #(parameter N = 4)(input clk, rst, en, up, load, input [N-1:0] d, output reg [N-1:0] q, output tc);
  assign tc = up ? &q : ~|q;
  always @(posedge clk)
    if (rst) q <= 0;
    else if (load) q <= d;
    else if (en) q <= up ? q + 1 : q - 1;
endmodule
module tb;
  reg clk = 0, rst = 1, en = 0, up = 1, load = 0; reg [3:0] d = 4'd12; wire [3:0] q; wire tc;
  updown #(4) c(clk, rst, en, up, load, d, q, tc);
  always #2 clk = ~clk;
  initial begin
    #5 rst = 0; en = 1;
    #20 load = 1; #4 load = 0;
    #20 up = 0;
    #24 $display("q=%d tc=%b", q, tc);
    $finish;
  end
  always @(posedge clk) if (tc) $display("%0t terminal count q=%d up=%b", $time, q, up);
endmodule
